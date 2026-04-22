import { apiError, apiResponse } from "@/lib/api-helpers";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { getMerchantFromSession } from "@/lib/auth";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const merchant = await getMerchantFromSession();
    const resolvedParams = await params;
    
    // We expect { action: "mark_processed" | "update_return_status", status?: string }
    const payload = await req.json();
    
    const supabase = createSupabaseServiceClient();

    if (payload.action === "mark_processed") {
      const { error } = await supabase
        .from("negotiations")
        .update({ 
          refund_processed: true, 
          refund_processed_at: new Date().toISOString() 
        })
        .eq("id", resolvedParams.id)
        .eq("merchant_id", merchant.id);

      if (error) return apiError("DB_ERROR", error.message, 500);
      return apiResponse({ success: true, marked: true });
    }

    if (payload.action === "update_return_status") {
      const { error } = await supabase
        .from("negotiations")
        .update({ return_status: payload.status })
        .eq("id", resolvedParams.id)
        .eq("merchant_id", merchant.id);

      if (error) return apiError("DB_ERROR", error.message, 500);
      return apiResponse({ success: true, updated: true });
    }

    return apiError("BAD_REQUEST", "Invalid action", 400);
  } catch (err) {
    return apiError("INTERNAL_ERROR", "Internal server error", 500);
  }
}
