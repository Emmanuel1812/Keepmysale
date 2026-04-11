import type { SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { buildShopifyInstallUrl, verifyShopifyHmac } from "@/lib/shopify/auth";
import { MerchantsDal } from "@/dal/merchants";
import { decryptAes256 } from "@/lib/encryption";

export class ShopifyService {
  constructor(private readonly supabase: SupabaseClient) {}

  private async getAccessToken(merchantId: string): Promise<{ accessToken: string; shopDomain: string }> {
    const merchantsDal = new MerchantsDal(this.supabase);
    const merchant = await merchantsDal.findById(merchantId);
    if (!merchant || !merchant.shopifyAccessTokenEncrypted) {
      throw new Error(`Merchant ${merchantId} not found or missing Shopify access token`);
    }
    const accessToken = decryptAes256(merchant.shopifyAccessTokenEncrypted);
    return { accessToken, shopDomain: merchant.shopDomain };
  }

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

  async processPartialRefund(merchantId: string, shopifyOrderId: string, amount: number, currency: string) {
    const { accessToken, shopDomain } = await this.getAccessToken(merchantId);
    
    // 1. Get transaction to find parent_id
    const transactionsResponse = await fetch(`https://${shopDomain}/admin/api/2025-01/orders/${shopifyOrderId}/transactions.json`, {
      headers: { "X-Shopify-Access-Token": accessToken },
    });
    
    if (!transactionsResponse.ok) {
      throw new Error(`Failed to fetch transactions for order ${shopifyOrderId}: ${await transactionsResponse.text()}`);
    }
    
    const { transactions } = await transactionsResponse.json();
    const parentTransaction = transactions.find((t: any) => t.kind === "sale" || t.kind === "capture");
    
    if (!parentTransaction) {
      throw new Error(`No suitable parent transaction found for order ${shopifyOrderId}`);
    }

    // 2. Create refund
    const refundBody = {
      refund: {
        currency,
        note: "AI Negotiation - Partial Refund approved by merchant",
        transactions: [
          {
            parent_id: parentTransaction.id,
            amount: amount.toFixed(2),
            kind: "refund",
            gateway: parentTransaction.gateway,
          },
        ],
      },
    };

    const refundResponse = await fetch(`https://${shopDomain}/admin/api/2025-01/orders/${shopifyOrderId}/refunds.json`, {
      method: "POST",
      headers: {
        "X-Shopify-Access-Token": accessToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(refundBody),
    });

    if (!refundResponse.ok) {
      const errorBody = await refundResponse.text();
      throw new Error(`Shopify Refund failed: ${errorBody}`);
    }

    const { refund } = await refundResponse.json();
    return refund;
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
