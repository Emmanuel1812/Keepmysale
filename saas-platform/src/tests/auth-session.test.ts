import crypto from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

// No network, no database: next/headers and both Supabase clients are replaced.
const headerStore = new Map<string, string>();
vi.mock("next/headers", () => ({
  headers: async () => ({ get: (name: string) => headerStore.get(name.toLowerCase()) ?? null }),
}));

const findByShopDomain = vi.fn();
const findByUserId = vi.fn();
vi.mock("@/services/merchant-service", () => ({
  MerchantService: class {
    findByShopDomain = findByShopDomain;
    findByUserId = findByUserId;
  },
}));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => ({ __client: "admin" }) }));

let cookieUser: { id: string } | null = null;
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({ auth: { getUser: async () => ({ data: { user: cookieUser } }) } }),
}));

import { getMerchantFromSession } from "@/lib/auth";

const API_KEY = process.env.SHOPIFY_API_KEY as string;
const API_SECRET = process.env.SHOPIFY_API_SECRET as string;
const SHOP = "efo-testing-store.myshopify.com";
const merchant = { id: "m1", shopDomain: SHOP };

function token(overrides: Record<string, unknown> = {}, secret = API_SECRET) {
  const now = Math.floor(Date.now() / 1000);
  const h = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const p = Buffer.from(
    JSON.stringify({ iss: `https://${SHOP}/admin`, dest: `https://${SHOP}`, aud: API_KEY, sub: "1", exp: now + 60, nbf: now - 5, ...overrides }),
  ).toString("base64url");
  return `${h}.${p}.${crypto.createHmac("sha256", secret).update(`${h}.${p}`).digest("base64url")}`;
}

beforeEach(() => {
  headerStore.clear();
  cookieUser = null;
  findByShopDomain.mockReset();
  findByUserId.mockReset();
});

describe("who is calling the API", () => {
  it("a valid Shopify session token yields the merchant of the VERIFIED shop", async () => {
    findByShopDomain.mockResolvedValue(merchant);
    headerStore.set("authorization", `Bearer ${token()}`);
    await expect(getMerchantFromSession()).resolves.toBe(merchant);
    expect(findByShopDomain).toHaveBeenCalledWith(SHOP);
  });

  it("THE FORMER HOLE: an X-Shop-Domain header alone no longer identifies anyone", async () => {
    findByShopDomain.mockResolvedValue(merchant);
    headerStore.set("x-shop-domain", SHOP);
    await expect(getMerchantFromSession()).rejects.toThrow("UNAUTHORIZED");
    expect(findByShopDomain).not.toHaveBeenCalled();
  });

  it("a forged token never reaches the database, and does not fall back to a cookie", async () => {
    cookieUser = { id: "cookie-user" };
    findByUserId.mockResolvedValue({ id: "someone-else" });
    headerStore.set("authorization", `Bearer ${token({}, "attacker-secret")}`);
    await expect(getMerchantFromSession()).rejects.toThrow("UNAUTHORIZED");
    expect(findByShopDomain).not.toHaveBeenCalled();
    expect(findByUserId).not.toHaveBeenCalled();
  });

  it("an expired token and a token for another app are refused", async () => {
    headerStore.set("authorization", `Bearer ${token({ exp: Math.floor(Date.now() / 1000) - 600 })}`);
    await expect(getMerchantFromSession()).rejects.toThrow("UNAUTHORIZED");
    headerStore.set("authorization", `Bearer ${token({ aud: "another-app" })}`);
    await expect(getMerchantFromSession()).rejects.toThrow("UNAUTHORIZED");
    expect(findByShopDomain).not.toHaveBeenCalled();
  });

  it("a valid token for a shop that never installed is refused", async () => {
    findByShopDomain.mockResolvedValue(null);
    headerStore.set("authorization", `Bearer ${token()}`);
    await expect(getMerchantFromSession()).rejects.toThrow("UNAUTHORIZED");
  });

  it("standalone: the Supabase cookie session still works (keepmysale.com)", async () => {
    cookieUser = { id: "u1" };
    findByUserId.mockResolvedValue(merchant);
    await expect(getMerchantFromSession()).resolves.toBe(merchant);
    expect(findByUserId).toHaveBeenCalledWith("u1");
  });

  it("no token and no cookie: refused", async () => {
    await expect(getMerchantFromSession()).rejects.toThrow("UNAUTHORIZED");
  });
});
