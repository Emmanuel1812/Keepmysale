import { NextResponse } from "next/server";
import { getMerchantFromSession } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { MerchantService } from "@/services/merchant-service";
import { apiError, apiResponse } from "@/lib/api-helpers";

export async function POST(request: Request) {
  try {
    const merchant = await getMerchantFromSession();
    const { confirmation } = await request.json();

    if (confirmation !== "DELETE") {
      return apiError("BAD_REQUEST", "Confirmation text must be 'DELETE'", 400);
    }

    const supabase = createSupabaseServiceClient();
    const merchantService = new MerchantService(supabase);

    console.log(`[Account Delete] Deleting all data for merchant: ${merchant.id} (${merchant.shopDomain})`);

    // Delete merchant from DB. Cascading deletes will handle orders, conversations, messages, etc.
    await merchantService.delete(merchant.id);

    return apiResponse({ success: true, message: "Account deleted successfully" });
  } catch (error: any) {
    console.error("[Account Delete] Error:", error);
    return apiError("INTERNAL_ERROR", "Could not delete account", 500);
  }
}
