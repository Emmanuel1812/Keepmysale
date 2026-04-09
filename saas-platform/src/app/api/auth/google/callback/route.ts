import { NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { encryptAes256 } from "@/lib/encryption";
import { getMerchantFromSession } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { MerchantService } from "@/services/merchant-service";
import { apiError } from "@/lib/api-helpers";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  const env = getEnv();

  if (error) {
    return NextResponse.redirect(new URL("/onboarding?error=google_denied", env.NEXT_PUBLIC_APP_URL));
  }

  if (!code) {
    return apiError("VALIDATION_ERROR", "Missing authorization code", 400);
  }

  try {
    // 1. MUST be logged in as a merchant
    let merchant;
    try {
      merchant = await getMerchantFromSession();
    } catch {
      return NextResponse.redirect(new URL("/onboarding?error=session_required", env.NEXT_PUBLIC_APP_URL));
    }

    // 2. Exchange code for tokens
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code,
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri: env.GOOGLE_REDIRECT_URI,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      throw new Error(`Google token exchange failed: ${JSON.stringify(errorData)}`);
    }

    const { access_token, refresh_token, expires_in } = await tokenResponse.json();

    // 3. Get user email
    const userinfoResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    
    if (!userinfoResponse.ok) {
      throw new Error("Failed to fetch Google user info");
    }

    const { email: googleEmail } = await userinfoResponse.json();

    // 4. Encrypt tokens
    const encryptedAccessToken = encryptAes256(access_token);
    const encryptedRefreshToken = refresh_token ? encryptAes256(refresh_token) : null;

    // 5. Update merchant in DB
    const supabase = await createSupabaseServerClient();
    const merchantService = new MerchantService(supabase);
    
    await merchantService.update(merchant.id, {
      googleAccessTokenEncrypted: encryptedAccessToken,
      googleRefreshTokenEncrypted: encryptedRefreshToken || merchant.googleRefreshTokenEncrypted,
      googleEmail: googleEmail,
    });

    // 6. Redirect to dashboard
    return NextResponse.redirect(new URL("/dashboard?google_success=true", env.NEXT_PUBLIC_APP_URL));
  } catch (err) {
    console.error("[GOOGLE_CALLBACK_ERROR]", err);
    return NextResponse.redirect(new URL("/onboarding?error=google_callback_failed", env.NEXT_PUBLIC_APP_URL));
  }
}
