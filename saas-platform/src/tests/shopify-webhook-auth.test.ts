import crypto from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const API_SECRET = "api-client-secret-0123456789abcdef";
const WEBHOOK_SECRET = "separate-webhook-secret-0123456789";

vi.mock("@/lib/env", () => ({
  getEnv: () => ({ SHOPIFY_API_SECRET: API_SECRET, SHOPIFY_WEBHOOK_SECRET: WEBHOOK_SECRET }),
}));

const merchantUpdate = vi.fn();
const findByShopDomain = vi.fn();
vi.mock("@/services/merchant-service", () => ({
  MerchantService: class {
    findByShopDomain = findByShopDomain;
    update = merchantUpdate;
  },
}));

// AiService reads GEMINI_API_KEY in its constructor; these tests never reach the AI
vi.mock("@/services/ai-service", () => ({ AiService: class {} }));

import { verifyShopifyWebhookSignature } from "@/lib/shopify/webhooks";
import { WebhookService } from "@/services/webhook-service";

const sign = (secret: string, body: string) => crypto.createHmac("sha256", secret).update(body, "utf8").digest("base64");

describe("Admin API webhook signature", () => {
  const body = JSON.stringify({ id: 1 });

  it("accepts a delivery signed with the app client secret (what Shopify really uses)", () => {
    expect(verifyShopifyWebhookSignature(body, sign(API_SECRET, body))).toBe(true);
  });

  it("still accepts the separately configured webhook secret", () => {
    expect(verifyShopifyWebhookSignature(body, sign(WEBHOOK_SECRET, body))).toBe(true);
  });

  it("rejects a wrong signature, a tampered body and a missing header", () => {
    expect(verifyShopifyWebhookSignature(body, sign("someone-else-entirely-0123456789", body))).toBe(false);
    expect(verifyShopifyWebhookSignature(body + " ", sign(API_SECRET, body))).toBe(false);
    expect(verifyShopifyWebhookSignature(body, null)).toBe(false);
  });
});

describe("app/uninstalled", () => {
  beforeEach(() => {
    merchantUpdate.mockReset();
    findByShopDomain.mockReset();
  });

  const deliver = (topic: string, shop = "efo-testing-store.myshopify.com") => {
    const body = JSON.stringify({ id: 1, myshopify_domain: shop });
    return new WebhookService({} as never).handleShopifyWebhook(body, sign(API_SECRET, body), { topic, shopDomain: shop });
  };

  it("clears the revoked Shopify token for that merchant", async () => {
    findByShopDomain.mockResolvedValue({ id: "m-1" });
    const result = await deliver("app/uninstalled");
    expect(merchantUpdate).toHaveBeenCalledWith("m-1", { shopifyAccessTokenEncrypted: null });
    expect(result).toMatchObject({ accepted: true, disconnected: true });
  });

  it("does nothing for a shop we do not know, and never touches another topic's merchant data", async () => {
    findByShopDomain.mockResolvedValue(null);
    await expect(deliver("app/uninstalled")).rejects.toThrow("Merchant not found");
    expect(merchantUpdate).not.toHaveBeenCalled();
  });

  it("does not clear the token for unrelated topics", async () => {
    findByShopDomain.mockResolvedValue({ id: "m-1" });
    await deliver("products/update");
    expect(merchantUpdate).not.toHaveBeenCalled();
  });
});
