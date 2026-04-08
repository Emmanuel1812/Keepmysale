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

  async registerWebhooks(shopDomain: string, accessToken: string) {
    const topics = [
      "orders/create",
      "orders/updated",
      "fulfillments/create",
      "fulfillments/update",
      "app/uninstalled",
    ];
    
    for (const topic of topics) {
      try {
        const response = await fetch(`https://${shopDomain}/admin/api/2025-01/webhooks.json`, {
          method: "POST",
          headers: {
            "X-Shopify-Access-Token": accessToken,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            webhook: {
              topic,
              address: "https://keepmysale.vercel.app/api/webhooks/shopify",
              format: "json",
            },
          }),
        });
        
        if (!response.ok) {
          const errorBody = await response.text();
          console.warn(`[ShopifyService] Failed to register webhook ${topic} for ${shopDomain}:`, response.status, errorBody);
        }
      } catch (error) {
        console.warn(`[ShopifyService] Exception during webhook ${topic} registration for ${shopDomain}:`, error);
      }
    }
  }
}
