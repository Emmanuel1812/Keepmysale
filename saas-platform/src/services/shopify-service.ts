import type { SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { buildShopifyInstallUrl, verifyShopifyHmac } from "@/lib/shopify/auth";

export class ShopifyService {
  constructor(private readonly supabase: SupabaseClient) {}

  createInstallLink(shop: string) {
    const state = randomUUID();
    const installUrl = buildShopifyInstallUrl(shop, state);
    return { installUrl, state };
  }

  validateOAuthCallback(params: URLSearchParams) {
    const hmac = params.get("hmac");
    const code = params.get("code");
    const shop = params.get("shop");

    if (!hmac || !code || !shop) {
      throw new Error("Missing OAuth callback parameters");
    }
    if (!verifyShopifyHmac(params, hmac)) {
      throw new Error("Invalid Shopify OAuth signature");
    }
    return { shop, code, hmac };
  }
}
