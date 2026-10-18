import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-helpers";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { ShopifyService } from "@/services/shopify-service";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");
  if (!shop) {
    return apiError("VALIDATION_ERROR", "shop query parameter is required", 400);
  }

  const supabase = createSupabaseServiceClient();
  const shopifyService = new ShopifyService(supabase);
  try {
    const { installUrl } = shopifyService.createInstallLink(shop);
    return NextResponse.redirect(installUrl);
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_SHOP_DOMAIN") {
      return apiError("VALIDATION_ERROR", "Enter your shop address, like your-store.myshopify.com", 400);
    }
    throw error;
  }
}
