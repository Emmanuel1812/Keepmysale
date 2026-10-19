import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { verifyShopifyAppWebhookSignature } from "@/lib/shopify/webhooks";
import { isValidShopDomain, normalizeShopDomain } from "@/lib/shopify/auth";
import {
  COMPLIANCE_TOPICS,
  ComplianceService,
  SupabaseComplianceStore,
  type ComplianceTopic,
  type CustomerPayload,
} from "@/services/compliance-service";

/**
 * Shopify's mandatory privacy webhooks. Shopify requires: 401 for a bad signature, 200 once handled.
 * The body is read raw because the signature covers the exact bytes.
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  if (!verifyShopifyAppWebhookSignature(rawBody, request.headers.get("x-shopify-hmac-sha256"))) {
    return new Response("Invalid signature", { status: 401 });
  }

  const topic = request.headers.get("x-shopify-topic") as ComplianceTopic | null;
  if (!topic || !COMPLIANCE_TOPICS.includes(topic)) {
    return new Response("Unsupported topic", { status: 400 });
  }

  let payload: CustomerPayload;
  try {
    payload = JSON.parse(rawBody) as CustomerPayload;
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const shopDomain = normalizeShopDomain(request.headers.get("x-shopify-shop-domain") ?? payload.shop_domain ?? "").toLowerCase();
  if (!isValidShopDomain(shopDomain)) {
    return new Response("Invalid shop", { status: 400 });
  }

  try {
    const service = new ComplianceService(new SupabaseComplianceStore(createSupabaseServiceClient()));
    const result = await service.handle(topic, shopDomain, payload);
    // Log what happened, never the customer's data.
    console.log("[compliance]", JSON.stringify({ topic, shop: shopDomain, ...result.detail, handled: result.handled }));
    return Response.json({ success: true, ...result });
  } catch (error) {
    console.error("[compliance] failed", topic, shopDomain, error instanceof Error ? error.message : error);
    // Not 200: Shopify retries failed deliveries, which is what we want for an erasure that did not happen.
    return new Response("Could not process", { status: 500 });
  }
}
