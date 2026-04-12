import { createSupabaseServerClient } from "@/lib/supabase/server";
import { MerchantService } from "@/services/merchant-service";
import type { IMerchant } from "@/types";

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
  }

  // Fallback: If we have a shopDomain (e.g. from X-Shop-Domain header), 
  // try to find the merchant by domain. This handles the Shopify iframe cookie blockage.
  if (shopDomain) {
    console.log("[auth] Falling back to shopDomain lookup:", shopDomain);
    const merchant = await merchantService.findByShopDomain(shopDomain);
    if (merchant) {
      return merchant;
    }
  }

  throw new Error("UNAUTHORIZED");
}
