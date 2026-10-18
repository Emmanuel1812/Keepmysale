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
