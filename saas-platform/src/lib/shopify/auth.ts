import crypto from "node:crypto";
import { getEnv } from "@/lib/env";

export function buildShopifyInstallUrl(shop: string, state: string) {
  const env = getEnv();
  const redirectUri = `${env.SHOPIFY_APP_URL}/api/shopify/callback`;
  const query = new URLSearchParams({
    client_id: env.SHOPIFY_API_KEY,
    scope: env.SHOPIFY_SCOPES,
    redirect_uri: redirectUri,
    state,
  });
  return `https://${shop}/admin/oauth/authorize?${query.toString()}`;
}

export function verifyShopifyHmac(query: URLSearchParams, hmac: string) {
  const env = getEnv();
  const sorted = [...query.entries()]
    .filter(([key]) => key !== "hmac" && key !== "signature")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");

  const digest = crypto.createHmac("sha256", env.SHOPIFY_API_SECRET).update(sorted).digest("hex");
  return digest === hmac;
}
