import { NextRequest, NextResponse } from "next/server";
import { getMerchantFromSession } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { MerchantService } from "@/services/merchant-service";
import { apiError, apiResponse } from "@/lib/api-helpers";
import { decryptAes256 } from "@/lib/encryption";
import { fetchGrantedScopes, hasExchangeScopes } from "@/lib/shopify/exchange-client";

export async function GET() {
  try {
    const merchant = await getMerchantFromSession();
    // Whether the automatic exchange can work for this shop (it needs read_returns + write_returns)
    let exchangeScopesGranted = false;
    if (merchant.shopifyAccessTokenEncrypted) {
      try {
        exchangeScopesGranted = hasExchangeScopes(await fetchGrantedScopes(merchant.shopDomain, decryptAes256(merchant.shopifyAccessTokenEncrypted)));
      } catch {
        exchangeScopesGranted = false;
      }
    }
    return apiResponse({
      id: merchant.id,
      exchangeScopesGranted,
      shopDomain: merchant.shopDomain,
      shopName: merchant.shopName,
      email: merchant.email,
      googleEmail: merchant.googleEmail,
      isShopifyConnected: !!merchant.shopifyAccessTokenEncrypted,
      subscriptionTier: merchant.subscriptionTier,
      subscriptionStatus: merchant.subscriptionStatus,
      settings: merchant.settings ?? {},
    });
  } catch (error) {
    return apiError("UNAUTHORIZED", "Unauthorized", 401);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const merchant = await getMerchantFromSession();

    let body;
    try {
      body = await request.json();
    } catch {
      return apiError("BAD_REQUEST", "Invalid JSON body", 400);
    }

    const { shopName, email, settings } = body;

    const supabase = createSupabaseServiceClient();
    const merchantService = new MerchantService(supabase);

    // Merge existing settings with new settings
    const existingSettings = (merchant.settings as unknown as Record<string, unknown>) ?? {};
    const newSettings = settings ? { ...existingSettings, ...settings } : existingSettings;

    const updatedMerchant = await merchantService.update(merchant.id, {
      shopName: shopName !== undefined ? shopName : merchant.shopName,
      email: email !== undefined ? email : merchant.email,
      settings: newSettings as any,
    });

    return apiResponse({
      id: updatedMerchant.id,
      shopName: updatedMerchant.shopName,
      email: updatedMerchant.email,
      settings: updatedMerchant.settings ?? {},
    });
  } catch (error) {
    console.error("[Settings API] Error:", error);
    return apiError("INTERNAL_ERROR", "Could not update settings", 500);
  }
}
