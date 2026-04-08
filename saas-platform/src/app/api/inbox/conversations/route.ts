import { apiError, apiResponse } from "@/lib/api-helpers";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { ConversationService } from "@/services/conversation-service";
import { getMerchantFromSession } from "@/lib/auth";

export async function GET() {
  let merchantId = "";
  try {
    const merchant = await getMerchantFromSession();
    merchantId = merchant.id;
  } catch {
    return apiError("UNAUTHORIZED", "Unauthorized", 401);
  }
  const supabase = createSupabaseServiceClient();
  const conversationService = new ConversationService(supabase);
  const conversations = await conversationService.findByMerchant(merchantId);
  return apiResponse({ conversations });
}
