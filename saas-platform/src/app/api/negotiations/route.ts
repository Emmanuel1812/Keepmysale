import { apiError, apiResponse } from "@/lib/api-helpers";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { getMerchantFromSession } from "@/lib/auth";
import { NegotiationService } from "@/services/negotiation-service";
import { OrdersDal } from "@/dal/orders";

export async function GET() {
  let merchantId = "";
  try {
    const merchant = await getMerchantFromSession();
    merchantId = merchant.id;
  } catch (err) {
    console.error("[negotiations GET] Unauthorized", err);
    return apiError("UNAUTHORIZED", "Unauthorized", 401);
  }

  const supabase = createSupabaseServiceClient();
  const negotiationService = new NegotiationService(supabase);
  const ordersDal = new OrdersDal(supabase);
  
  const negotiations = await negotiationService.findByMerchant(merchantId);
  const orders = await ordersDal.findByMerchant(merchantId);
  
  // Create a map for quick order lookups
  const ordersMap = new Map(orders.map(o => [o.id, o]));
  
  // Combine it
  const enrichedNegotiations = negotiations.map(neg => {
    const order = neg.orderId ? ordersMap.get(neg.orderId) : undefined;
    return {
      ...neg,
      orderNumber: order?.shopifyOrderNumber || order?.shopifyOrderId || "Unknown",
      customerEmail: order?.email || "Unknown",
      orderValue: order?.totalPrice || "0.00",
      currency: order?.currency || "EUR",
    };
  });

  return apiResponse({ negotiations: enrichedNegotiations });
}
