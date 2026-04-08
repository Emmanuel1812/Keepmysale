import crypto from "node:crypto";
import { getEnv } from "@/lib/env";

export function verifyShopifyWebhookSignature(rawBody: string, headerSignature: string | null) {
  if (!headerSignature) return false;
  const env = getEnv();
  const digest = crypto
    .createHmac("sha256", env.SHOPIFY_WEBHOOK_SECRET)
    .update(rawBody, "utf8")
    .digest("base64");
  return digest === headerSignature;
}
