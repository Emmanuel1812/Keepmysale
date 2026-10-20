import { NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { getMerchantFromSession } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { MerchantService } from "@/services/merchant-service";
import { apiResponse, apiError } from "@/lib/api-helpers";
import { randomUUID } from "node:crypto";
import { GOOGLE_OAUTH_STATE_COOKIE, GOOGLE_OAUTH_STATE_PATH } from "@/lib/google/oauth-state";
import { OAUTH_STATE_MAX_AGE_SECONDS } from "@/lib/shopify/oauth-state";

export async function GET(request: Request) {
  const env = getEnv();
  
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_REDIRECT_URI) {
    return new Response("Google OAuth is not configured", { status: 500 });
  }

  // The state cookie must be set on the host Google returns to, or the callback cannot find it
  const callbackHost = new URL(env.GOOGLE_REDIRECT_URI).host;
  if (new URL(request.url).host !== callbackHost && process.env.NODE_ENV === "production") {
    return NextResponse.redirect(new URL("/api/auth/google", env.GOOGLE_REDIRECT_URI));
  }
  const state = randomUUID();

  const rootUrl = "https://accounts.google.com/o/oauth2/v2/auth";
  const options = {
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: env.GOOGLE_REDIRECT_URI,
    response_type: "code",
    scope: [
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/gmail.send",
      "https://www.googleapis.com/auth/gmail.modify",
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/userinfo.profile",
    ].join(" "),
    access_type: "offline",
    prompt: "consent",
    state,
  };

  const queryString = new URLSearchParams(options).toString();
  const url = `${rootUrl}?${queryString}`;

  const response = NextResponse.redirect(url);
  response.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: GOOGLE_OAUTH_STATE_PATH,
    maxAge: OAUTH_STATE_MAX_AGE_SECONDS,
  });
  return response;
}

export async function DELETE() {
  try {
    const merchant = await getMerchantFromSession();
    const supabase = createSupabaseServiceClient();
    const merchantService = new MerchantService(supabase);

    await merchantService.update(merchant.id, {
      googleAccessTokenEncrypted: null,
      googleRefreshTokenEncrypted: null,
      googleEmail: null,
    });

    return apiResponse({ disconnected: true });
  } catch (error) {
    console.error("[GOOGLE_DISCONNECT_ERROR]", error);
    return apiError("INTERNAL_ERROR", "Could not disconnect Google account", 500);
  }
}
