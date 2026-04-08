import { apiError, apiResponse } from "@/lib/api-helpers";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { ShopifyService } from "@/services/shopify-service";

export async function GET(request: Request) {
  const shop = new URL(request.url).searchParams.get("shop");
  if (!shop) {
    return apiError("VALIDATION_ERROR", "shop query parameter is required", 400);
  }

  const supabase = createSupabaseServiceClient();
  const shopifyService = new ShopifyService(supabase);
  return apiResponse(shopifyService.createInstallLink(shop));
}
