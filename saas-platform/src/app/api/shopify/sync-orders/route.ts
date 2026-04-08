import { apiError, apiResponse } from "@/lib/api-helpers";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { getMerchantFromSession } from "@/lib/auth";
import { decryptAes256 } from "@/lib/encryption";
import { OrderService } from "@/services/order-service";
import { CustomerService } from "@/services/customer-service";
import { MerchantService } from "@/services/merchant-service";

function isLikelyValidShopifyToken(token: string): boolean {
  const trimmed = token.trim();
  return /^[A-Za-z0-9_\-]{20,}$/.test(trimmed);
}

function normalizeShopDomain(shopDomain: string): string {
  const sanitized = shopDomain.trim().replace(/^https?:\/\//i, "").replace(/\/+$/, "");
  const withoutAdmin = sanitized.replace(/\/admin$/i, "");
  return withoutAdmin.split("/")[0];
}

export async function POST() {
  let merchant;
  try {
    merchant = await getMerchantFromSession();
  } catch {
    return apiError("UNAUTHORIZED", "Unauthorized", 401);
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

  const response = await fetch(`https://${shopDomain}/admin/api/2025-01/orders.json?limit=50`, {
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
      const customer = await customerService.resolveCustomer({
        merchantId: merchant.id,
        email,
        language: merchant.settings?.language ?? "nl",
      });
      customerId = customer.id;
    }

    await orderService.upsertFromShopify(merchant.id, order, customerId);
    synced += 1;
  }

  return apiResponse({ synced });
}
