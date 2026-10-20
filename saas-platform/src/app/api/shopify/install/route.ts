import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-helpers";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { ShopifyService } from "@/services/shopify-service";
import { getEnv } from "@/lib/env";
import { OAUTH_STATE_COOKIE, OAUTH_STATE_MAX_AGE_SECONDS } from "@/lib/shopify/oauth-state";
import { EXCHANGE_SCOPES } from "@/lib/shopify/exchange-client";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");
  if (!shop) {
    return apiError("VALIDATION_ERROR", "shop query parameter is required", 400);
  }

  // Shopify always returns to SHOPIFY_APP_URL, and the state cookie is bound to the host that set it. An install started
  // on another host (a Vercel preview, www.) would lose its cookie on the way back, so start it on the canonical host.
  const canonicalHost = new URL(getEnv().SHOPIFY_APP_URL).host;
  if (url.host !== canonicalHost && process.env.NODE_ENV === "production") {
    return NextResponse.redirect(new URL(`/api/shopify/install?shop=${encodeURIComponent(shop)}${url.search.includes("extra=") ? `&extra=${encodeURIComponent(url.searchParams.get("extra") ?? "")}` : ""}`, getEnv().SHOPIFY_APP_URL));
  }

  const supabase = createSupabaseServiceClient();
  const shopifyService = new ShopifyService(supabase);
  try {
    // ?extra=exchanges asks the shop for the extra scopes the automatic exchange needs (Settings → Negotiation)
    const extraScopes = url.searchParams.get("extra") === "exchanges" ? EXCHANGE_SCOPES : [];
    const { installUrl, state } = shopifyService.createInstallLink(shop, extraScopes);
    const response = NextResponse.redirect(installUrl);
    // Lax so the cookie comes back on Shopify's top-level redirect to our callback, but not on cross-site subrequests
    response.cookies.set(OAUTH_STATE_COOKIE, state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/api/shopify",
      maxAge: OAUTH_STATE_MAX_AGE_SECONDS,
    });
    return response;
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_SHOP_DOMAIN") {
      return apiError("VALIDATION_ERROR", "Enter your shop address, like your-store.myshopify.com", 400);
    }
    throw error;
  }
}
