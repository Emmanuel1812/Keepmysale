import { NextRequest, NextResponse } from "next/server";
import { getMerchantFromSession } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { apiError, apiResponse } from "@/lib/api-helpers";
import { createRefund } from "@/lib/shopify/client";
import { decryptAes256 } from "@/lib/encryption";

export async function POST(request: NextRequest) {
  try {
    const merchant = await getMerchantFromSession();

    let body;
    try {
      body = await request.json();
    } catch {
      return apiError("BAD_REQUEST", "Invalid JSON body", 400);
    }

    const { orderId, amount, currency } = body;

    if (!orderId || !amount || !currency) {
      return apiError("BAD_REQUEST", "Missing orderId, amount, or currency", 400);
    }

    if (!merchant.shopifyAccessTokenEncrypted) {
      return apiError("FORBIDDEN", "Shopify not connected", 403);
    }

    const accessToken = decryptAes256(merchant.shopifyAccessTokenEncrypted);

    console.log(`[Refund API] Triggering partial refund for order ${orderId}, amount: ${amount} ${currency}`);

    const result = await createRefund({
      shopDomain: merchant.shopDomain,
      accessToken,
      orderId,
      amount: Number(amount),
      currency,
    });

    return apiResponse({ 
      success: true, 
      refundId: result.refundId,
      transactionId: result.transactionId
    });
  } catch (error: any) {
    console.error("[Refund API] Error:", error);
    return apiError("INTERNAL_ERROR", error.message || "Could not process refund", 500);
  }
}
