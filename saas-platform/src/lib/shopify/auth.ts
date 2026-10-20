import crypto from "node:crypto";
import { getEnv } from "@/lib/env";

const SHOP_DOMAIN_PATTERN = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/;

/** True only for a bare "<name>.myshopify.com" host - nothing else may reach an OAuth URL. */
export function isValidShopDomain(shop: string): boolean {
  return SHOP_DOMAIN_PATTERN.test(shop);
}

export function buildShopifyInstallUrl(shopInput: string, state: string, extraScopes: readonly string[] = []) {
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
    // Extra scopes for an optional feature (the automatic exchange asks for write_returns); base scopes always stay
    scope: [...new Set([...env.SHOPIFY_SCOPES.split(",").map((x) => x.trim()).filter(Boolean), ...extraScopes])].join(","),
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
  const a = Buffer.from(digest);
  const b = Buffer.from(hmac);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function normalizeShopDomain(shopDomain: string): string {
  const sanitized = shopDomain.trim().replace(/^https?:\/\//i, "").replace(/\/+$/, "");
  const withoutAdmin = sanitized.replace(/\/admin$/i, "");
  return withoutAdmin.split("/")[0];
}

/**
 * A launch from Shopify admin carries a signed query string (hmac, shop, host, timestamp...).
 * True only when the signature is valid AND it was issued recently, so an old link cannot be replayed.
 */
export function isFreshSignedLaunch(query: URLSearchParams, maxAgeSeconds = 3600, now = Math.floor(Date.now() / 1000)): boolean {
  const hmac = query.get("hmac");
  const timestamp = Number(query.get("timestamp"));
  if (!hmac || !Number.isFinite(timestamp)) return false;
  if (Math.abs(now - timestamp) > maxAgeSeconds) return false;
  return verifyShopifyHmac(query, hmac);
}
