import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-helpers";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getEnv } from "@/lib/env";
import { encryptAes256 } from "@/lib/encryption";
import { MerchantService } from "@/services/merchant-service";
import { ShopifyService } from "@/services/shopify-service";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const adminSupabase = createSupabaseAdminClient();
  const serverSupabase = await createSupabaseServerClient();
  const shopifyService = new ShopifyService(adminSupabase);
  const merchantService = new MerchantService(adminSupabase);
  const env = getEnv();

  try {
    const { shop, code } = shopifyService.validateOAuthCallback(url.searchParams);

    const tokenResponse = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: env.SHOPIFY_API_KEY,
        client_secret: env.SHOPIFY_API_SECRET,
        code,
      }),
      cache: "no-store",
    });
    if (!tokenResponse.ok) {
      throw new Error(`Shopify token exchange failed with ${tokenResponse.status}`);
    }

    const tokenPayload = (await tokenResponse.json()) as {
      access_token?: string;
      scope?: string;
    };
    const accessToken = tokenPayload.access_token;
    if (!accessToken) {
      throw new Error("Shopify token exchange returned no access token");
    }

    const shopResponse = await fetch(`https://${shop}/admin/api/2025-01/shop.json`, {
      headers: {
        "X-Shopify-Access-Token": accessToken,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });
    if (!shopResponse.ok) {
      throw new Error(`Shop data fetch failed with ${shopResponse.status}`);
    }

    const shopPayload = (await shopResponse.json()) as {
      shop?: { name?: string; email?: string; domain?: string };
    };
    const shopName = shopPayload.shop?.name ?? shop;
    const shopEmail = shopPayload.shop?.email ?? `owner@${shop}`;
    const encryptedToken = encryptAes256(accessToken);

    const {
      data: { user: sessionUser },
    } = await serverSupabase.auth.getUser();

    const authEmail = shopEmail || `owner@${shop}`;
    let supabaseUserId = sessionUser?.id ?? null;
    if (!supabaseUserId) {
      const existingUsers = await adminSupabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const existingByEmail = existingUsers.data.users.find((user) => user.email === authEmail);
      if (existingByEmail) {
        supabaseUserId = existingByEmail.id;
      } else {
        const createdUser = await adminSupabase.auth.admin.createUser({
          email: authEmail,
          email_confirm: true,
          user_metadata: { shop_domain: shop },
        });
        if (createdUser.error || !createdUser.data.user) {
          throw createdUser.error ?? new Error("Failed to create Supabase user");
        }
        supabaseUserId = createdUser.data.user.id;
      }
    }

    const existingMerchant = await merchantService.findByShopDomain(shop);
    let merchant = existingMerchant
      ? await merchantService.update(existingMerchant.id, {
          supabaseUserId,
          shopDomain: shop,
          shopName,
          email: shopEmail,
          shopifyAccessTokenEncrypted: encryptedToken,
        })
      : await merchantService.create({
          supabaseUserId,
          shopDomain: shop,
          shopName,
          email: shopEmail,
          subscriptionTier: "starter",
          subscriptionStatus: "trial",
          onboardingCompleted: false,
        });

    if (!existingMerchant) {
      merchant = await merchantService.update(merchant.id, {
        supabaseUserId,
        shopifyAccessTokenEncrypted: encryptedToken,
      });
    }

    const linkResult = await adminSupabase.auth.admin.generateLink({
      type: "magiclink",
      email: authEmail,
    });
    if (linkResult.error) {
      throw linkResult.error;
    }

    const hashedToken = linkResult.data.properties?.hashed_token;
    if (!hashedToken) {
      throw new Error("Failed to create login token");
    }

    const verifyResult = await serverSupabase.auth.verifyOtp({
      token_hash: hashedToken,
      type: "magiclink",
    });
    if (verifyResult.error) {
      throw verifyResult.error;
    }

    const redirectPath = merchant.onboardingCompleted ? "/dashboard" : "/onboarding/configure";
    return NextResponse.redirect(new URL(redirectPath, env.NEXT_PUBLIC_APP_URL));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid callback";
    if (message === "Missing OAuth callback parameters") {
      return apiError("VALIDATION_ERROR", message, 400);
    }
    return apiError("UNAUTHORIZED", message, 401);
  }
}
