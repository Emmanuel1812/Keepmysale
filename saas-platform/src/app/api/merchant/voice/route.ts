import { getMerchantFromSession } from "@/lib/auth";
import { apiError, apiResponse } from "@/lib/api-helpers";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { VoiceError, learnVoice } from "@/services/voice-service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Settings → AI persona → "Learn from my sent replies". */
export async function POST() {
  let merchant;
  try {
    merchant = await getMerchantFromSession();
  } catch {
    return apiError("UNAUTHORIZED", "Unauthorized", 401);
  }
  try {
    const profile = await learnVoice(createSupabaseServiceClient(), merchant);
    return apiResponse({ voiceProfile: profile, voiceEnabled: true });
  } catch (error) {
    if (error instanceof VoiceError) {
      return apiError(error.code.toUpperCase(), error.message, error.code === "not_enough_samples" ? 422 : 400);
    }
    console.error("[VOICE_LEARN_ERROR]", error);
    return apiError("INTERNAL_ERROR", "Could not learn your voice", 500);
  }
}
