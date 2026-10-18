import crypto from "node:crypto";
import { getEnv } from "@/lib/env";

const SHOP_DOMAIN_PATTERN = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/;

/** True only for a bare "<name>.myshopify.com" host - nothing else may reach an OAuth URL. */
export function isValidShopDomain(shop: string): boolean {
  return SHOP_DOMAIN_PATTERN.test(shop);
}

export function buildShopifyInstallUrl(shopInput: string, state: string) {
  // The merchant types this by hand ("https://store.myshopify.com/", "store.myshopify.com/admin"...).
  // Clean it first, then refuse anything that is not a real myshopify host: building the URL from raw
  // input produced "https://https//store.myshopify.com//admin/..." and let any host be redirected to.
  const shop = normalizeShopDomain(shopInput).toLowerCase();
  if (!isValidShopDomain(shop)) {
    throw new Error("INVALID_SHOP_DOMAIN");
  }
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

export function normalizeShopDomain(shopDomain: string): string {
  const sanitized = shopDomain.trim().replace(/^https?:\/\//i, "").replace(/\/+$/, "");
  const withoutAdmin = sanitized.replace(/\/admin$/i, "");
  return withoutAdmin.split("/")[0];
}
