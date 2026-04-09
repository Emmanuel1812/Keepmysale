import { NextResponse } from "next/server";
import { getEnv } from "@/lib/env";

export async function GET() {
  const env = getEnv();
  
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_REDIRECT_URI) {
    return new Response("Google OAuth is not configured", { status: 500 });
  }

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
  };

  const queryString = new URLSearchParams(options).toString();
  const url = `${rootUrl}?${queryString}`;

  return NextResponse.redirect(url);
}

export async function DELETE() {
  try {
    const { getMerchantFromSession } = await import("@/lib/auth");
    const { createSupabaseServiceClient } = await import("@/lib/supabase/server");
    const { MerchantService } = await import("@/services/merchant-service");
    const { apiResponse, apiError } = await import("@/lib/api-helpers");

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
    const { apiError } = await import("@/lib/api-helpers");
    return apiError("INTERNAL_ERROR", "Could not disconnect Google account", 500);
  }
}
