import crypto from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const SECRET = "test-shopify-api-secret-0123456789";
const jar = new Map<string, string>();

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined) }),
}));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => ({}) }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({}),
  createSupabaseServiceClient: () => ({}),
}));
vi.mock("@/lib/env", () => ({
  getEnv: () => ({
    SHOPIFY_API_KEY: "key",
    SHOPIFY_API_SECRET: SECRET,
    SHOPIFY_SCOPES: "read_orders",
    SHOPIFY_APP_URL: "https://keepmysale.com",
    NEXT_PUBLIC_APP_URL: "https://keepmysale.com",
  }),
}));

import { GET as callback } from "@/app/api/shopify/callback/route";
import { GET as install } from "@/app/api/shopify/install/route";
import { OAUTH_STATE_COOKIE, isFreshOAuthTimestamp, isValidOAuthState } from "@/lib/shopify/oauth-state";

function signedCallback(params: Record<string, string>) {
  const query = new URLSearchParams(params);
  const message = [...query.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
  query.set("hmac", crypto.createHmac("sha256", SECRET).update(message).digest("hex"));
  return new Request(`https://keepmysale.com/api/shopify/callback?${query.toString()}`);
}

const now = () => String(Math.floor(Date.now() / 1000));

describe("oauth state helpers", () => {
  it("accepts only an identical state", () => {
    expect(isValidOAuthState("abc-123", "abc-123")).toBe(true);
    expect(isValidOAuthState("abc-123", "abc-124")).toBe(false);
    expect(isValidOAuthState("abc-123", "abc-1234")).toBe(false);
    expect(isValidOAuthState(undefined, "abc-123")).toBe(false);
    expect(isValidOAuthState("abc-123", null)).toBe(false);
    expect(isValidOAuthState("", "")).toBe(false);
  });

  it("rejects stale, future-dated and malformed timestamps", () => {
    const base = 1_800_000_000;
    expect(isFreshOAuthTimestamp(String(base - 60), base)).toBe(true);
    expect(isFreshOAuthTimestamp(String(base - 3600), base)).toBe(false);
    expect(isFreshOAuthTimestamp(String(base + 3600), base)).toBe(false);
    expect(isFreshOAuthTimestamp("soon", base)).toBe(false);
    expect(isFreshOAuthTimestamp(null, base)).toBe(false);
  });
});

describe("shopify install + callback", () => {
  const fetchSpy = vi.fn();

  beforeEach(() => {
    jar.clear();
    fetchSpy.mockReset();
    vi.stubGlobal("fetch", fetchSpy);
  });

  it("install remembers the state it sends to Shopify in an httpOnly cookie", async () => {
    const res = await install(new Request("https://keepmysale.com/api/shopify/install?shop=efo-testing-store.myshopify.com"));
    const location = new URL(res.headers.get("location")!);
    const cookie = res.cookies.get(OAUTH_STATE_COOKIE);
    expect(cookie?.value).toBeTruthy();
    expect(location.searchParams.get("state")).toBe(cookie?.value);
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe("lax");
  });

  it("install started on another host (preview, www) is first moved to the canonical host so the cookie survives", async () => {
    vi.stubEnv("NODE_ENV", "production");
    try {
      const res = await install(
        new Request("https://keepmysale-git-x.vercel.app/api/shopify/install?shop=efo-testing-store.myshopify.com"),
      );
      expect(res.headers.get("location")).toBe(
        "https://keepmysale.com/api/shopify/install?shop=efo-testing-store.myshopify.com",
      );
      expect(res.cookies.get(OAUTH_STATE_COOKIE)).toBeUndefined();
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("callback with a valid Shopify signature but no state cookie is refused before any token exchange", async () => {
    const res = await callback(
      signedCallback({ shop: "efo-testing-store.myshopify.com", code: "c0de", state: "s1", timestamp: now() }),
    );
    expect(res.status).toBe(401);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("callback whose state does not match the browser's cookie is refused", async () => {
    jar.set(OAUTH_STATE_COOKIE, "attacker-state");
    const res = await callback(
      signedCallback({ shop: "efo-testing-store.myshopify.com", code: "c0de", state: "victim-state", timestamp: now() }),
    );
    expect(res.status).toBe(401);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("callback with a matching state but an old timestamp is refused", async () => {
    jar.set(OAUTH_STATE_COOKIE, "s1");
    const old = String(Math.floor(Date.now() / 1000) - 7200);
    const res = await callback(
      signedCallback({ shop: "efo-testing-store.myshopify.com", code: "c0de", state: "s1", timestamp: old }),
    );
    expect(res.status).toBe(401);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("callback for a non-myshopify host is refused even when signed and state matches", async () => {
    jar.set(OAUTH_STATE_COOKIE, "s1");
    const res = await callback(
      signedCallback({ shop: "evil.example.com", code: "c0de", state: "s1", timestamp: now() }),
    );
    expect(res.status).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("callback with a matching state, fresh timestamp and valid host proceeds to the token exchange", async () => {
    jar.set(OAUTH_STATE_COOKIE, "s1");
    fetchSpy.mockResolvedValue({ ok: false, status: 400, json: async () => ({}) });
    await callback(signedCallback({ shop: "efo-testing-store.myshopify.com", code: "c0de", state: "s1", timestamp: now() }));
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(String(fetchSpy.mock.calls[0][0])).toBe("https://efo-testing-store.myshopify.com/admin/oauth/access_token");
  });
});
