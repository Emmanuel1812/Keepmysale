import { NextRequest } from "next/server";
import { apiError, apiResponse } from "@/lib/api-helpers";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { getMerchantFromSession } from "@/lib/auth";
import { NegotiationService } from "@/services/negotiation-service";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  
  let merchantId = "";
  try {
    const merchant = await getMerchantFromSession();
    merchantId = merchant.id;
  } catch (err) {
    return apiError("UNAUTHORIZED", "Unauthorized", 401);
  }

  const supabase = createSupabaseServiceClient();
  const negotiationService = new NegotiationService(supabase);
  
  try {
    // Verify negotiation belongs to merchant
    const negotiation = await negotiationService.findById(id);
    if (!negotiation || negotiation.merchantId !== merchantId) {
      return apiError("NOT_FOUND", "Negotiation not found", 404);
    }

    const updated = await negotiationService.finalizeRefund(id);
    
    return apiResponse({ 
      success: true, 
      negotiation: updated 
    });
  } catch (error: any) {
    console.error("[negotiation refund POST] Error:", error);
    return apiError("INTERNAL_ERROR", error.message || "Failed to execute refund", 500);
  }
}
