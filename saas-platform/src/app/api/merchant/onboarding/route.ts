import { zOnboardingPayload } from "@/lib/validators";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { apiError, apiResponse } from "@/lib/api-helpers";
import { MerchantService } from "@/services/merchant-service";
import { getMerchantFromSession } from "@/lib/auth";
import type { IMerchantSettings } from "@/types";
import { DEFAULT_MERCHANT_SETTINGS } from "@/types/merchant";

function normalizeShopDomain(shopDomain: string): string {
  const sanitized = shopDomain.trim().replace(/^https?:\/\//i, "").replace(/\/+$/, "");
  const withoutAdmin = sanitized.replace(/\/admin$/i, "");
  return withoutAdmin.split("/")[0];
}

export async function POST(request: Request) {
  let merchantId = "";
  try {
    const merchant = await getMerchantFromSession();
    merchantId = merchant.id;
  } catch {
    return apiError("UNAUTHORIZED", "Unauthorized", 401);
  }

  const body = await request.json();
  const parsed = zOnboardingPayload.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", "Invalid onboarding payload", 400, parsed.error.flatten());
  }

  const supabase = createSupabaseServiceClient();
  const merchantService = new MerchantService(supabase);
  try {
    const existingMerchant = await merchantService.findById(merchantId);
    if (!existingMerchant) {
      return apiError("NOT_FOUND", "Merchant not found", 404);
    }

    const defaultSettings: IMerchantSettings = {
      ...DEFAULT_MERCHANT_SETTINGS,
    };
    const baseSettings: IMerchantSettings = {
      ...defaultSettings,
      ...(existingMerchant.settings ?? {}),
    };

    const settings: IMerchantSettings = {
      ...baseSettings,
      negotiation_steps: [
        { step: 1, type: "partial_refund", percentage: parsed.data.step1Percentage },
        { step: 2, type: "partial_refund", percentage: parsed.data.step2Percentage },
        { step: 3, type: "store_credit", percentage: parsed.data.step3Percentage },
      ],
    };

    const normalizedShopDomain = normalizeShopDomain(parsed.data.shopDomain);

    let merchant;
    try {
      merchant = await merchantService.update(merchantId, {
        shopName: parsed.data.merchantName,
        shopDomain: normalizedShopDomain,
        email: parsed.data.supportEmail,
        onboardingCompleted: true,
        settings,
      });
    } catch (updateError) {
      const errorCode =
        typeof updateError === "object" &&
        updateError !== null &&
        "code" in updateError &&
        typeof (updateError as { code?: unknown }).code === "string"
          ? (updateError as { code: string }).code
          : null;
      const isUniqueViolation = errorCode === "23505";
      if (!isUniqueViolation) {
        throw updateError;
      }

      // Recover from duplicate shop_domain rows by updating the canonical shop record.
      const byShopDomain = await merchantService.findByShopDomain(normalizedShopDomain);
      if (!byShopDomain) {
        throw updateError;
      }

      if (byShopDomain.id !== existingMerchant.id) {
        // Prevent breaking .single() queries later by deleting the orphaned merchant record
        // before transferring the supabaseUserId to the canonical record.
        await merchantService.delete(existingMerchant.id);
      }

      merchant = await merchantService.update(byShopDomain.id, {
        supabaseUserId: existingMerchant.supabaseUserId,
        shopName: parsed.data.merchantName,
        shopDomain: normalizedShopDomain,
        email: parsed.data.supportEmail,
        onboardingCompleted: true,
        settings,
      });
    }
    return apiResponse({ merchantId: merchant.id });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : typeof error === "object" &&
            error !== null &&
            "message" in error &&
            typeof (error as { message?: unknown }).message === "string"
          ? (error as { message: string }).message
          : "Could not create merchant";
    return apiError("DB_ERROR", message, 500);
  }
}
