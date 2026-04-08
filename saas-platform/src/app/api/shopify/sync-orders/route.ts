import { apiError, apiResponse } from "@/lib/api-helpers";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { getMerchantFromSession } from "@/lib/auth";
import { decryptAes256 } from "@/lib/encryption";
import { OrderService } from "@/services/order-service";
import { CustomerService } from "@/services/customer-service";

function normalizeShopDomain(shopDomain: string): string {
  const sanitized = shopDomain.trim().replace(/^https?:\/\//i, "").replace(/\/+$/, "");
  return sanitized.replace(/\/admin$/i, "");
}

export async function POST() {
  let merchant;
  try {
    merchant = await getMerchantFromSession();
  } catch {
    return apiError("UNAUTHORIZED", "Unauthorized", 401);
  }

  if (!merchant.shopifyAccessTokenEncrypted) {
    return apiError("VALIDATION_ERROR", "Merchant has no Shopify token configured", 400);
  }

  const supabase = createSupabaseServiceClient();
  const orderService = new OrderService(supabase);
  const customerService = new CustomerService(supabase);
  const accessToken = decryptAes256(merchant.shopifyAccessTokenEncrypted);
  const shopDomain = normalizeShopDomain(merchant.shopDomain);

  const response = await fetch(`https://${shopDomain}/admin/api/2025-01/orders.json?limit=50&status=any`, {
    headers: {
      "X-Shopify-Access-Token": accessToken,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    return apiError("UPSTREAM_ERROR", `Shopify sync failed with status ${response.status}`, 502);
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
