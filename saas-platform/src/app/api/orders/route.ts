import { apiError, apiResponse } from "@/lib/api-helpers";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { getMerchantFromSession } from "@/lib/auth";
import { OrderService } from "@/services/order-service";

export async function GET() {
  let merchantId = "";
  try {
    const merchant = await getMerchantFromSession();
    merchantId = merchant.id;
  } catch {
    return apiError("UNAUTHORIZED", "Unauthorized", 401);
  }

  const supabase = createSupabaseServiceClient();
  const orderService = new OrderService(supabase);
  const orders = await orderService.findByMerchant(merchantId);
  return apiResponse({ orders });
}
