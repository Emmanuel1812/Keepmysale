import { headers } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { MerchantService } from "@/services/merchant-service";
import type { IMerchant } from "@/types";
import { getEnv } from "@/lib/env";
import { bearerToken, verifyShopifySessionToken } from "@/lib/shopify/session-token";

/**
 * Who is calling? Two honest ways, in this order:
 *
 * 1. Embedded in Shopify admin: a Shopify session token (JWT) in `Authorization: Bearer`.
 *    Browsers block third-party cookies inside that iframe, so the cookie never arrives.
 *    The shop is taken from the VERIFIED token, never from anything the caller typed.
 * 2. Standalone (keepmysale.com): the Supabase session cookie.
 *
 * There is deliberately no third way. A former fallback trusted an `X-Shop-Domain` header,
 * which let anyone who knew a shop's domain read that shop's data.
 */
export async function getMerchantFromSession(): Promise<IMerchant> {
  const requestHeaders = await headers();
  const token = bearerToken(requestHeaders.get("authorization"));

  if (token) {
    const env = getEnv();
    const verified = verifyShopifySessionToken(token, {
      apiKey: env.SHOPIFY_API_KEY,
      apiSecret: env.SHOPIFY_API_SECRET,
    });
    if (!verified.ok) {
      console.warn("[auth] Shopify session token rejected:", verified.reason);
      throw new Error("UNAUTHORIZED");
    }
    // Service-role lookup is safe here: the shop domain was cryptographically verified above.
    const merchant = await new MerchantService(createSupabaseAdminClient()).findByShopDomain(verified.shop);
    if (merchant) return merchant;
    console.warn("[auth] Valid session token for a shop with no merchant row:", verified.shop);
    throw new Error("UNAUTHORIZED");
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const merchant = await new MerchantService(supabase).findByUserId(user.id);
    if (merchant) return merchant;
    console.warn("[auth] User logged in but no merchant found in DB. UserId:", user.id);
  }

  throw new Error("UNAUTHORIZED");
}
