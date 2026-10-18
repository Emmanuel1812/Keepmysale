import { describe, expect, it } from "vitest";
import { buildShopifyInstallUrl, isValidShopDomain } from "@/lib/shopify/auth";

// Pure tests: no network, no database.
describe("the shop address a merchant types", () => {
  const hostOf = (shop: string) => new URL(buildShopifyInstallUrl(shop, "s")).host;

  it.each([
    "efo-testing-store.myshopify.com",
    "https://efo-testing-store.myshopify.com/",
    "https://efo-testing-store.myshopify.com//",
    "  EFO-Testing-Store.myshopify.com/admin  ",
    "http://efo-testing-store.myshopify.com/admin/",
  ])("%j becomes the one correct install host", (input) => {
    expect(hostOf(input)).toBe("efo-testing-store.myshopify.com");
  });

  it("never produces a doubled scheme or a double slash before /admin", () => {
    const url = buildShopifyInstallUrl("https://efo-testing-store.myshopify.com/", "s");
    expect(url.startsWith("https://efo-testing-store.myshopify.com/admin/oauth/authorize?")).toBe(true);
    expect(url.includes("https://https")).toBe(false);
  });

  it.each(["evil.com", "evil.com/x.myshopify.com", "store.myshopify.com.evil.com", "", "myshopify.com", "a b.myshopify.com"])(
    "refuses %j instead of redirecting to it",
    (input) => {
      expect(() => buildShopifyInstallUrl(input, "s")).toThrow("INVALID_SHOP_DOMAIN");
    },
  );

  it("isValidShopDomain accepts only bare myshopify hosts", () => {
    expect(isValidShopDomain("a-1.myshopify.com")).toBe(true);
    expect(isValidShopDomain("https://a.myshopify.com")).toBe(false);
  });
});

import crypto from "node:crypto";
import { isFreshSignedLaunch } from "@/lib/shopify/auth";

describe("a launch link from Shopify admin", () => {
  const secret = process.env.SHOPIFY_API_SECRET as string;
  const NOW = 1_800_000_000;

  function signedQuery(extra: Record<string, string>, signWith = secret) {
    const base = new URLSearchParams({ shop: "efo-testing-store.myshopify.com", host: "aG9zdA", embedded: "1", ...extra });
    const sorted = [...base.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join("&");
    base.set("hmac", crypto.createHmac("sha256", signWith).update(sorted).digest("hex"));
    return base;
  }

  it("is accepted when correctly signed and recent", () => {
    expect(isFreshSignedLaunch(signedQuery({ timestamp: String(NOW - 30) }), 3600, NOW)).toBe(true);
  });

  it("is refused when signed with another secret, tampered, stale, or unsigned", () => {
    expect(isFreshSignedLaunch(signedQuery({ timestamp: String(NOW - 30) }, "attacker"), 3600, NOW)).toBe(false);

    const tampered = signedQuery({ timestamp: String(NOW - 30) });
    tampered.set("shop", "victim.myshopify.com");
    expect(isFreshSignedLaunch(tampered, 3600, NOW)).toBe(false);

    expect(isFreshSignedLaunch(signedQuery({ timestamp: String(NOW - 7200) }), 3600, NOW)).toBe(false);

    const unsigned = new URLSearchParams({ shop: "efo-testing-store.myshopify.com", host: "aG9zdA", timestamp: String(NOW) });
    expect(isFreshSignedLaunch(unsigned, 3600, NOW)).toBe(false);
  });
});
