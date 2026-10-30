import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";

// The homepage at / shows public/homepage2.html in an iframe, so the site must be
// allowed to frame itself. Without 'self' every visitor sees "refused to connect".
describe("frame-ancestors", () => {
  it("lets the site frame itself and still allows Shopify admin, nothing else", async () => {
    const rules = await nextConfig.headers!();
    const csp = rules.flatMap((r) => r.headers).find((h) => h.key === "Content-Security-Policy")!.value;
    const sources = csp.replace("frame-ancestors", "").trim().split(/\s+/).sort();
    expect(sources).toEqual(["'self'", "https://*.myshopify.com", "https://admin.shopify.com"].sort());
  });
});
