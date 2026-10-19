import crypto from "node:crypto";
import { getEnv } from "@/lib/env";

function matches(secret: string, rawBody: string, headerSignature: string | null): boolean {
  if (!headerSignature || !secret) return false;
  const digest = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("base64");
  const a = Buffer.from(digest);
  const b = Buffer.from(headerSignature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Store webhooks registered through the Admin API (signed with SHOPIFY_WEBHOOK_SECRET). */
export function verifyShopifyWebhookSignature(rawBody: string, headerSignature: string | null) {
  return matches(getEnv().SHOPIFY_WEBHOOK_SECRET, rawBody, headerSignature);
}

/**
 * Webhooks declared in the app configuration, including the three mandatory privacy (compliance) topics,
 * are signed with the app's client secret.
 */
export function verifyShopifyAppWebhookSignature(rawBody: string, headerSignature: string | null) {
  return matches(getEnv().SHOPIFY_API_SECRET, rawBody, headerSignature);
}
