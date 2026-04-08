import crypto from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { MerchantService } from "@/services/merchant-service";
import { CustomersDal } from "@/dal/customers";
import { OrdersDal } from "@/dal/orders";
import { WebhookService } from "@/services/webhook-service";

function signShopifyPayload(rawBody: string): string {
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET ?? "";
  return crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("base64");
}

describe("Shopify webhook processing", () => {
  let supabase: SupabaseClient;
  let merchantService: MerchantService;
  let customersDal: CustomersDal;
  let ordersDal: OrdersDal;
  let webhookService: WebhookService;

  let merchantId = "";
  let customerId = "";
  let runTag = "";

  beforeAll(async () => {
    supabase = createSupabaseAdminClient();
    merchantService = new MerchantService(supabase);
    customersDal = new CustomersDal(supabase);
    ordersDal = new OrdersDal(supabase);
    webhookService = new WebhookService(supabase);
    runTag = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    const merchant = await merchantService.create({
      shopDomain: `shopify-e2e-${runTag}.myshopify.com`,
      shopName: "Shopify E2E Merchant",
      email: `shopify-e2e-${runTag}@test.local`,
      subscriptionTier: "starter",
      subscriptionStatus: "active",
      onboardingCompleted: true,
    });
    merchantId = merchant.id;

    const customer = await customersDal.create({
      merchantId,
      email: "shopify-customer@test.nl",
      name: "Shopify Customer",
      language: "nl",
    });
    customerId = customer.id;
  });

  afterAll(async () => {
    if (merchantId) {
      await merchantService.delete(merchantId);
    }
  });

  it("processes orders/create and upserts order with customer link", async () => {
    const payload = {
      id: `gid://shopify/Order/${runTag}-2001`,
      name: "#2001",
      email: "shopify-customer@test.nl",
      financial_status: "paid",
      fulfillment_status: "unfulfilled",
      total_price: "149.95",
      currency: "EUR",
      line_items: [{ sku: "SKU-2001", quantity: 1 }],
    };
    const rawBody = JSON.stringify(payload);
    const hmac = signShopifyPayload(rawBody);

    const result = await webhookService.handleShopifyWebhook(rawBody, hmac, {
      topic: "orders/create",
      shopDomain: `shopify-e2e-${runTag}.myshopify.com`,
    });
    expect(result.accepted).toBe(true);
    expect(result.topic).toBe("orders/create");

    const orders = await ordersDal.findByMerchant(merchantId);
    const order = orders.find((o) => o.shopifyOrderId === payload.id);
    expect(order).toBeTruthy();
    expect(order?.shopifyOrderNumber).toBe("#2001");
    expect(order?.customerId).toBe(customerId);
    expect(order?.email).toBe("shopify-customer@test.nl");
  });

  it("processes fulfillments/update and updates tracking + delivery", async () => {
    const existing = await ordersDal.create({
      merchantId,
      shopifyOrderId: `gid://shopify/Order/${runTag}-3001`,
      shopifyOrderNumber: "#3001",
      customerId,
      email: "shopify-customer@test.nl",
      totalPrice: 59.99,
      currency: "EUR",
    });

    const payload = {
      order_id: `${runTag}-3001`,
      tracking_number: "TRACK-3001",
      tracking_url: "https://carrier.example/track-3001",
      tracking_company: "PostNL",
      shipment_status: "delivered",
    };
    const rawBody = JSON.stringify(payload);
    const hmac = signShopifyPayload(rawBody);

    const result = await webhookService.handleShopifyWebhook(rawBody, hmac, {
      topic: "fulfillments/update",
      shopDomain: `shopify-e2e-${runTag}.myshopify.com`,
    });
    expect(result.accepted).toBe(true);
    expect(result.topic).toBe("fulfillments/update");
    expect(result.orderId).toBe(existing.id);

    const updated = await ordersDal.findById(existing.id);
    expect(updated?.trackingNumber).toBe("TRACK-3001");
    expect(updated?.trackingUrl).toBe("https://carrier.example/track-3001");
    expect(updated?.trackingCompany).toBe("PostNL");
    expect(updated?.deliveredAt).toBeTruthy();
    expect(updated?.proactiveCheckSent).toBe(false);
  });
});
