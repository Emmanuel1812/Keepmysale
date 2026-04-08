import { apiError, apiResponse } from "@/lib/api-helpers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getMerchantFromSession } from "@/lib/auth";

export async function GET() {
  let merchant;
  try {
    merchant = await getMerchantFromSession();
  } catch {
    return apiError("UNAUTHORIZED", "Unauthorized", 401);
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return apiResponse({
    merchant: {
      id: merchant.id,
      shopDomain: merchant.shopDomain,
      shopName: merchant.shopName,
      email: merchant.email,
      onboardingCompleted: merchant.onboardingCompleted,
      settings: merchant.settings,
    },
    user: user
      ? {
          id: user.id,
          email: user.email ?? null,
          createdAt: user.created_at ?? null,
          lastSignInAt: user.last_sign_in_at ?? null,
        }
      : null,
  });
}
