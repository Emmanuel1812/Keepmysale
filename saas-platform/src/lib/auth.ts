import { createSupabaseServerClient } from "@/lib/supabase/server";
import { MerchantService } from "@/services/merchant-service";
import type { IMerchant } from "@/types";

export async function getMerchantFromSession(): Promise<IMerchant> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error("UNAUTHORIZED");
  }

  const merchantService = new MerchantService(supabase);
  const merchant = await merchantService.findByUserId(user.id);
  if (!merchant) {
    throw new Error("UNAUTHORIZED");
  }

  return merchant;
}
