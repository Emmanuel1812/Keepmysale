import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextResponse } from "next/server";

const jar = new Map<string, string>();
const merchantUpdate = vi.fn();
const fetchSpy = vi.fn();

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined) }),
}));
vi.mock("@/lib/env", () => ({
  getEnv: () => ({
    GOOGLE_CLIENT_ID: "cid",
    GOOGLE_CLIENT_SECRET: "csecret",
    GOOGLE_REDIRECT_URI: "https://keepmysale.com/api/auth/google/callback",
    NEXT_PUBLIC_APP_URL: "https://keepmysale.com",
  }),
}));
vi.mock("@/lib/auth", () => ({ getMerchantFromSession: async () => ({ id: "m1", googleRefreshTokenEncrypted: null }) }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({}),
  createSupabaseServiceClient: () => ({}),
}));
vi.mock("@/lib/encryption", () => ({ encryptAes256: (v: string) => `enc(${v})` }));
vi.mock("@/services/merchant-service", () => ({
  MerchantService: class {
    update = merchantUpdate;
  },
}));

import { GET as start } from "@/app/api/auth/google/route";
import { GET as callback } from "@/app/api/auth/google/callback/route";
import { GOOGLE_OAUTH_STATE_COOKIE } from "@/lib/google/oauth-state";

const cb = (query: string) => callback(new Request(`https://keepmysale.com/api/auth/google/callback?${query}`));

describe("Gmail connect: OAuth state", () => {
  beforeEach(() => {
    jar.clear();
    merchantUpdate.mockReset();
    fetchSpy.mockReset();
    vi.stubGlobal("fetch", fetchSpy);
  });

  it("start puts the same random state in the Google URL and in an httpOnly cookie", async () => {
    const res = (await start(new Request("https://keepmysale.com/api/auth/google"))) as NextResponse;
    const state = new URL(res.headers.get("location")!).searchParams.get("state");
    const cookie = res.cookies.get(GOOGLE_OAUTH_STATE_COOKIE);
    expect(state).toBeTruthy();
    expect(cookie?.value).toBe(state);
    expect(cookie?.httpOnly).toBe(true);
  });

  it("a callback without the browser's state cookie connects nothing and never exchanges the code", async () => {
    const res = await cb("code=attacker-code&state=s1");
    expect(res.headers.get("location")).toContain("google_state_mismatch");
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(merchantUpdate).not.toHaveBeenCalled();
  });

  it("a callback whose state differs from the cookie is refused", async () => {
    jar.set(GOOGLE_OAUTH_STATE_COOKIE, "mine");
    const res = await cb("code=attacker-code&state=theirs");
    expect(res.headers.get("location")).toContain("google_state_mismatch");
    expect(merchantUpdate).not.toHaveBeenCalled();
  });

  it("a matching state connects the mailbox", async () => {
    jar.set(GOOGLE_OAUTH_STATE_COOKIE, "s1");
    fetchSpy
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: "at", refresh_token: "rt", expires_in: 3600 }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ email: "shop@example.com" }) });
    const res = await cb("code=good&state=s1");
    expect(res.headers.get("location")).toContain("google_success=true");
    expect(merchantUpdate).toHaveBeenCalledWith("m1", expect.objectContaining({ googleEmail: "shop@example.com" }));
  });
});
