import { apiError, apiResponse } from "@/lib/api-helpers";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { getMerchantFromSession } from "@/lib/auth";
import { OrderService } from "@/services/order-service";

export async function GET(request: Request) {
  let merchantId = "";
  try {
    const merchant = await getMerchantFromSession();
    merchantId = merchant.id;
  } catch (err) {
    console.error("[orders GET] Unauthorized", err);
    return apiError("UNAUTHORIZED", "Unauthorized", 401);
  }

  const supabase = createSupabaseServiceClient();
  const orderService = new OrderService(supabase);
  
  // Only this merchant's orders. An empty list is the right answer for a shop with no orders yet: an earlier
  // "temporary workaround" returned every merchant's orders (emails included) in that case.
  const orders = await orderService.findByMerchant(merchantId);

  return apiResponse({ orders });
}
