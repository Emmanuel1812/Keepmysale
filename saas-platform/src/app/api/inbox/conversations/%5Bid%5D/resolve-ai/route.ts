import { apiError, apiResponse } from "@/lib/api-helpers";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { getMerchantFromSession } from "@/lib/auth";
import { WebhookService } from "@/services/webhook-service";
import { NextRequest } from "next/server";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<any> }
) {
  const { id } = await params;
  const conversationId = id;
  if (!conversationId) return apiError("BAD_REQUEST", "Missing conversation ID", 400);

  let merchantId = "";
  try {
    const merchant = await getMerchantFromSession();
    merchantId = merchant.id;
  } catch {
    return apiError("UNAUTHORIZED", "Unauthorized", 401);
  }

  const supabase = createSupabaseServiceClient();
  const webhookService = new WebhookService(supabase);

  try {
    const result = await webhookService.processAiResolution(conversationId, merchantId);
    return apiResponse(result);
  } catch (error: any) {
    console.error("[RESOLVE_AI_API] Error:", error);
    return apiError("INTERNAL_ERROR", error.message || "Failed to resolve with AI", 500);
  }
}
