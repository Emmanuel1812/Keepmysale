import type { SupabaseClient } from "@supabase/supabase-js";
import { MerchantsDal } from "@/dal/merchants";
import { getGmailMessage, getValidAccessToken, listSentReplyIds } from "@/lib/gmail/client";
import { GROQ_MODELS, callGroqWithRetry, createGroqClient } from "@/lib/ai/groq-client";
import {
  VOICE_MIN_SAMPLES,
  buildVoiceLearningPrompt,
  parseVoiceProfile,
  selectVoiceSamples,
  type VoiceProfile,
} from "@/lib/automation/voice";
import { DIGEST_HEADER } from "@/services/draft-digest-service";
import type { IMerchant } from "@/types";

export class VoiceError extends Error {
  constructor(public readonly code: "gmail_not_connected" | "not_enough_samples" | "ai_unavailable", message: string) {
    super(message);
  }
}

const stripHtml = (s: string) =>
  /<[a-z][\s\S]*>/i.test(s)
    ? s.replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n\n").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
    : s;

/**
 * Reads the merchant's own sent replies (read-only), has the AI describe how they write, and stores that profile
 * in settings with the voice switched on. Our own AI replies and digests are left out, or the shop would learn
 * to sound like KeepMySale instead of like itself.
 */
export async function learnVoice(supabase: SupabaseClient, merchant: IMerchant): Promise<VoiceProfile> {
  if (!merchant.googleEmail) throw new VoiceError("gmail_not_connected", "Connect Gmail first");

  const accessToken = await getValidAccessToken(merchant);
  const ids = await listSentReplyIds(accessToken, 40);
  const mails = [];
  for (let i = 0; i < ids.length; i += 10) {
    const batch = await Promise.all(ids.slice(i, i + 10).map((id) => getGmailMessage(accessToken, id).catch(() => null)));
    mails.push(...batch);
  }
  const bodies = mails
    .filter((m): m is NonNullable<typeof m> => Boolean(m))
    .filter((m) => !m.headers.some((h) => h.name?.toLowerCase() === DIGEST_HEADER.toLowerCase()))
    .map((m) => stripHtml(m.body));

  const { data: aiRows } = await supabase
    .from("messages")
    .select("content")
    .eq("merchant_id", merchant.id)
    .in("sender", ["ai", "ai_draft"])
    .order("created_at", { ascending: false })
    .limit(300);
  const samples = selectVoiceSamples(bodies, (aiRows ?? []).map((r: { content: string | null }) => String(r.content ?? "")));
  if (samples.length < VOICE_MIN_SAMPLES) {
    throw new VoiceError(
      "not_enough_samples",
      `Found ${samples.length} replies you wrote yourself; at least ${VOICE_MIN_SAMPLES} are needed to learn your voice.`,
    );
  }

  const groq = createGroqClient();
  if (!groq) throw new VoiceError("ai_unavailable", "AI is not configured");
  const prompt = buildVoiceLearningPrompt(samples);
  let profile: VoiceProfile | null = null;
  for (const model of [GROQ_MODELS.PRIMARY, GROQ_MODELS.LIGHT]) {
    try {
      const raw = await callGroqWithRetry(groq, [{ role: "user", content: prompt }], model, 0);
      profile = raw ? parseVoiceProfile(raw, samples.length) : null;
      if (profile) break;
    } catch (error) {
      console.warn(`[VOICE] ${model} failed:`, error instanceof Error ? error.message : error);
    }
  }
  if (!profile) throw new VoiceError("ai_unavailable", "Could not describe your writing style, try again in a minute");

  const merchants = new MerchantsDal(supabase);
  const fresh = ((await merchants.findById(merchant.id))?.settings ?? merchant.settings ?? {}) as unknown as Record<string, unknown>;
  await merchants.update(merchant.id, { settings: { ...fresh, voice_profile: profile, voice_enabled: true } as any });
  return profile;
}
