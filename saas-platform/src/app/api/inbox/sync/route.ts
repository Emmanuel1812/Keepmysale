import { NextResponse } from "next/server";
import { getMerchantFromSession } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { AutomationService } from "@/services/automation-service";
import { apiError, apiResponse } from "@/lib/api-helpers";

export async function POST() {
  try {
    const merchant = await getMerchantFromSession();
    const supabase = createSupabaseServiceClient();
    const automationService = new AutomationService(supabase);

    console.log(`[Manual Sync] Triggering for: ${merchant.shopDomain}`);
    
    const result = await automationService.pollMerchantEmails(merchant);

    return apiResponse(result);
  } catch (error: any) {
    console.error("[Manual Sync] Error:", error);
    return apiError("INTERNAL_ERROR", "Could not sync emails", 500);
  }
}
