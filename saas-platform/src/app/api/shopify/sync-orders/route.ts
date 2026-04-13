import { apiError, apiResponse } from "@/lib/api-helpers";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { getMerchantFromSession } from "@/lib/auth";
import { decryptAes256 } from "@/lib/encryption";
import { OrderService } from "@/services/order-service";
import { CustomerService } from "@/services/customer-service";
import { MerchantService } from "@/services/merchant-service";
import { normalizeShopDomain } from "@/lib/shopify/auth";

function isLikelyValidShopifyToken(token: string): boolean {
  const trimmed = token.trim();
  return /^[A-Za-z0-9_\-]{20,}$/.test(trimmed);
}


export async function POST(request: Request) {
  try {
    // --- DIAGNOSTIC HEALTHCHECK ---
    const env = getEnv();
    console.log("[API] sync-orders healthcheck:", {
      hasShopifyKey: !!process.env.SHOPIFY_API_KEY,
      hasShopifySecret: !!process.env.SHOPIFY_API_SECRET,
      hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasServiceRole: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      hasEncryptionKey: !!process.env.ENCRYPTION_KEY,
      encryptionKeyLength: process.env.ENCRYPTION_KEY?.length,
    });

    const shopDomainHeader = request.headers.get("x-shop-domain") || undefined;
    let merchant;
    try {
      merchant = await getMerchantFromSession(shopDomainHeader);
    } catch (err) {
      console.error("[API] sync-orders UNAUTHORIZED:", err);
      return apiError("UNAUTHORIZED", "Unauthorized - No merchant found for session", 401);
    }

    if (!merchant.shopifyAccessTokenEncrypted) {
      return apiError("VALIDATION_ERROR", "Merchant has no Shopify token configured", 400, {
        reconnectUrl: `/api/shopify/install?shop=${encodeURIComponent(normalizeShopDomain(merchant.shopDomain))}`,
      });
    }

    const supabase = createSupabaseServiceClient();
    const orderService = new OrderService(supabase);
    const customerService = new CustomerService(supabase);
    const merchantService = new MerchantService(supabase);
    let accessToken = "";
    try {
      accessToken = decryptAes256(merchant.shopifyAccessTokenEncrypted);
    } catch {
      return apiError("CONFIG_ERROR", "Could not decrypt Shopify token", 500);
    }
    if (!isLikelyValidShopifyToken(accessToken)) {
      return apiError(
        "CONFIG_ERROR",
        "Stored Shopify token is invalid. Reconnect Shopify from onboarding.",
        500,
      );
    }
    const shopDomain = normalizeShopDomain(merchant.shopDomain);

    const response = await fetch(`https://${shopDomain}/admin/api/2025-01/orders.json?limit=50&status=any`, {
      headers: {
        "X-Shopify-Access-Token": accessToken,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const upstreamBody = await response.text();
      console.error("[SHOPIFY_SYNC_ERROR] Status:", response.status, "Body:", upstreamBody);
      
      if (response.status === 403) {
        return apiError(
          "SHOPIFY_MISSING_SCOPES",
          `Shopify 403 Forbidden. The app doesn't have permissions to read orders. Detail: ${upstreamBody.slice(0, 300)}`,
          403,
          {
            shopDomain,
            upstreamStatus: response.status,
            upstreamBody: upstreamBody.slice(0, 300),
          },
        );
      }

      if (response.status === 401) {
        await merchantService.update(merchant.id, {
          shopifyAccessTokenEncrypted: null,
        });
        return apiError(
          "SHOPIFY_AUTH_FAILED",
          "Shopify rejected the token. Reconnect Shopify and try again.",
          401,
          {
            reconnectUrl: `/api/shopify/install?shop=${encodeURIComponent(shopDomain)}`,
            shopDomain,
            upstreamStatus: response.status,
            upstreamBody: upstreamBody.slice(0, 300),
          },
        );
      }
      if (response.status === 404) {
        return apiError(
          "SHOPIFY_DOMAIN_INVALID",
          "Shop domain appears invalid. Reconnect Shopify to refresh domain settings.",
          400,
          {
            shopDomain,
            upstreamStatus: response.status,
            upstreamBody: upstreamBody.slice(0, 300),
          },
        );
      }
      return apiError(
        "UPSTREAM_ERROR",
        `Shopify sync failed with status ${response.status}`,
        502,
        {
          shopDomain,
          upstreamStatus: response.status,
          upstreamBody: upstreamBody.slice(0, 300),
        },
      );
    }

    const payload = (await response.json()) as { orders?: Array<Record<string, unknown>> };
    const orders = payload.orders ?? [];

    let synced = 0;
    for (const order of orders) {
      const email = (order.email as string | undefined) ?? null;
      let customerId: string | null = null;
      if (email) {
        const shopifyCustomer = order.customer as Record<string, any> | undefined;
        const firstName = shopifyCustomer?.first_name ?? "";
        const lastName = shopifyCustomer?.last_name ?? "";
        const fullName = [firstName, lastName].filter(Boolean).join(" ");

        const customer = await customerService.resolveCustomer({
          merchantId: merchant.id,
          email,
          name: fullName || null,
          language: merchant.settings?.language ?? "nl",
        });
        customerId = customer.id;
      }

      await orderService.upsertFromShopify(merchant.id, order, customerId);
      synced += 1;
    }

    return apiResponse({ synced });
  } catch (error: any) {
    console.error("[API_CRASH] sync-orders:", error);
    return apiError("INTERNAL_SERVER_ERROR", error.message || "An unexpected error occurred", 500);
  }
}
