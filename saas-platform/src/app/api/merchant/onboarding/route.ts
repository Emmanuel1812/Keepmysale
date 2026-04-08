import { zOnboardingPayload } from "@/lib/validators";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { apiError, apiResponse } from "@/lib/api-helpers";
import { MerchantService } from "@/services/merchant-service";
import { getMerchantFromSession } from "@/lib/auth";
import type { IMerchantSettings } from "@/types";

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
      business_hours: { start: "09:00", end: "17:00" },
      timezone: "Europe/Amsterdam",
      auto_respond: true,
      language: "nl",
      return_negotiation_enabled: true,
      negotiation_offers: [
        { step: 1, type: "partial_refund", percentage: 20 },
        { step: 2, type: "partial_refund", percentage: 35 },
        { step: 3, type: "store_credit", percentage: 50 },
      ],
      escalation_email: null,
      proactive_check_enabled: true,
      proactive_check_delay_hours: 48,
    };
    const baseSettings: IMerchantSettings = {
      ...defaultSettings,
      ...(existingMerchant.settings ?? {}),
    };

    const settings: IMerchantSettings = {
      ...baseSettings,
      negotiation_offers: [
        { step: 1, type: "partial_refund", percentage: parsed.data.step1Percentage },
        { step: 2, type: "partial_refund", percentage: parsed.data.step2Percentage },
        { step: 3, type: "store_credit", percentage: parsed.data.step3Percentage },
      ],
    };

    const merchant = await merchantService.update(merchantId, {
      shopName: parsed.data.merchantName,
      shopDomain: normalizeShopDomain(parsed.data.shopDomain),
      email: parsed.data.supportEmail,
      onboardingCompleted: true,
      settings,
    });
    return apiResponse({ merchantId: merchant.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create merchant";
    return apiError("DB_ERROR", message, 500);
  }
}
