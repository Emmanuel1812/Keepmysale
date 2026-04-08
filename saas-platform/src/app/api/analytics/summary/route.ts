import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { apiError, apiResponse } from "@/lib/api-helpers";
import { AnalyticsService } from "@/services/analytics-service";
import { getMerchantFromSession } from "@/lib/auth";

export async function GET() {
  let merchantId = "";
  let shopName: string | null = null;
  try {
    const merchant = await getMerchantFromSession();
    merchantId = merchant.id;
    shopName = merchant.shopName;
  } catch {
    return apiError("UNAUTHORIZED", "Unauthorized", 401);
  }

  const supabase = createSupabaseServiceClient();
  const analyticsService = new AnalyticsService(supabase);
  const summary = await analyticsService.getSummary(merchantId);

  return apiResponse({ ...summary, shopName });
}
