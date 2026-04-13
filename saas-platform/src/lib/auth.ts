import { createSupabaseServerClient } from "@/lib/supabase/server";
import { MerchantService } from "@/services/merchant-service";
import type { IMerchant } from "@/types";
import { normalizeShopDomain } from "@/lib/shopify/auth";

export async function getMerchantFromSession(shopDomain?: string): Promise<IMerchant> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const merchantService = new MerchantService(supabase);

  if (user) {
    const merchant = await merchantService.findByUserId(user.id);
    if (merchant) {
      return merchant;
    }
    console.warn("[auth] User logged in but no merchant found in DB. UserId:", user.id);
  }

  // Fallback: If we have a shopDomain (e.g. from X-Shop-Domain header), 
  // try to find the merchant by domain. This handles the Shopify iframe cookie blockage.
  if (shopDomain) {
    const normalized = normalizeShopDomain(shopDomain);
    console.log("[auth] Falling back to shopDomain lookup:", normalized);
    const merchant = await merchantService.findByShopDomain(normalized);
    if (merchant) {
      return merchant;
    }
    console.warn("[auth] Shop domain lookup failed. Domain:", normalized);
  }

  throw new Error("UNAUTHORIZED");
}
