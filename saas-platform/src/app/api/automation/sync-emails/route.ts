import { apiError, apiResponse } from "@/lib/api-helpers";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { getMerchantFromSession } from "@/lib/auth";
import { AutomationService } from "@/services/automation-service";

export async function POST() {
  let merchant;
  try {
    merchant = await getMerchantFromSession();
  } catch {
    return apiError("UNAUTHORIZED", "Unauthorized", 401);
  }

  const supabase = createSupabaseServiceClient();
  const automationService = new AutomationService(supabase);

  try {
    console.log(`[API_SYNC_EMAILS] Manual sync triggered for: ${merchant.shopDomain}`);
    const result = await automationService.pollMerchantEmails(merchant);
    
    if (result.status === "error") {
      return apiError("SYNC_FAILED", result.error || "Failed to sync emails", 500);
    }

    return apiResponse({
      processedCount: result.emailsProcessed,
      foundCount: result.emailsFound
    });
  } catch (err: any) {
    console.error("[API_SYNC_EMAILS_FAILURE]", err);
    return apiError("INTERNAL_ERROR", err.message, 500);
  }
}
