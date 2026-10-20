import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ groq: vi.fn() }));

vi.mock("@/lib/ai/groq-client", () => ({
  GROQ_MODELS: { PRIMARY: "openai/gpt-oss-120b", LIGHT: "openai/gpt-oss-20b" },
  createGroqClient: () => ({}),
  callGroqWithRetry: (...args: unknown[]) => state.groq(...args),
}));
vi.mock("@/lib/gemini/client", () => ({
  GEMINI_MODELS: { PRIMARY: "gemini-test" },
  createGeminiClient: () => null,
  callGeminiWithRetry: vi.fn(),
}));
vi.mock("@/services/order-service", () => ({
  OrderService: class {
    findByMerchant = async () => [];
    fetchShopifyOrderByName = async () => null;
  },
}));

import { buildStyleBlock, extractOwnText, parseVoiceProfile, selectVoiceSamples, type VoiceProfile } from "@/lib/automation/voice";
import { AiService } from "@/services/ai-service";
import { isReply } from "@/services/voice-service";
import { DEFAULT_MERCHANT_SETTINGS } from "@/types/merchant";
import type { IIntentStructuredResult } from "@/types/ai";

const profile: VoiceProfile = {
  summary: "Schrijf kort en direct, met je/jij, één uitroepteken per mail en geen formele zinnen.",
  address: "je",
  examples: ["Komt helemaal goed!"],
  learnedAt: "2026-10-21T00:00:00Z",
  sampleCount: 12,
};

describe("extractOwnText", () => {
  it("keeps what the merchant wrote and drops the quoted thread, in nl/en/pt", () => {
    expect(extractOwnText("Hoi Sanne,\n\nKomt goed!\n\nOp di 20 okt 2026 om 10:00 schreef Sanne <s@x.nl>:\n> waar is mijn pakket")).toBe("Hoi Sanne,\n\nKomt goed!");
    expect(extractOwnText("Sure thing.\nOn Tue, Oct 20, 2026 at 10:00 AM Pat <p@x.com> wrote:\nold")).toBe("Sure thing.");
    expect(extractOwnText("Claro!\nEm ter., 20 de out. de 2026 às 10:00, Ana <a@x.pt> escreveu:\nold")).toBe("Claro!");
    expect(extractOwnText("Top\n> quoted line\nnog iets")).toBe("Top\nnog iets");
  });
});

describe("selectVoiceSamples", () => {
  it("leaves out our own AI replies, short notes and duplicates", () => {
    const ai = "Je bestelling #1005 heeft trackingnummer 26564613 en is onderweg naar je toe. Je ontvangt hem binnen twee werkdagen.";
    const own = "Hoi! Je pakket is gisteren de deur uit gegaan, morgen heb je het binnen. Fijne dag!";
    // as it went out: greeting added, different line breaks
    const sentAi = `Goedemiddag Sanne,\n\nJe bestelling #1005 heeft trackingnummer 26564613 en is\nonderweg naar je toe. Je ontvangt hem binnen twee werkdagen.\n\nMet vriendelijke groet`;
    const samples = selectVoiceSamples([sentAi, "Ok thx", own, own], [ai]);
    expect(samples).toEqual([own]);
  });

  it("leaves out mails carrying the sign-off KeepMySale adds itself", () => {
    const sent = "Het spijt me dat de jas beschadigd is aangekomen, we lossen het op.\n\nMet vriendelijke groet,\nefo-testing-store Klantenservice";
    expect(selectVoiceSamples([sent], [], "efo-testing-store Klantenservice")).toEqual([]);
    expect(selectVoiceSamples([sent], [])).toHaveLength(1);
  });
});

describe("isReply", () => {
  it("learns only from answers, not from outreach the same mailbox sends", () => {
    expect(isReply({ subject: "Re: waar is mijn pakket", headers: [] })).toBe(true);
    expect(isReply({ subject: "Antw: retour", headers: [] })).toBe(true);
    expect(isReply({ subject: "pakket", headers: [{ name: "In-Reply-To", value: "<a@b>" }] })).toBe(true);
    expect(isReply({ subject: "Nemen jullie nog nieuwe klanten aan?", headers: [] })).toBe(false);
  });
});

describe("parseVoiceProfile", () => {
  it("clamps the AI's answer and refuses an empty one", () => {
    const p = parseVoiceProfile(JSON.stringify({ summary: "Schrijf kort en warm, met je.", address: "jij", examples: ["a", 3, "b", "c", "d"] }), 7);
    expect(p).toMatchObject({ summary: "Schrijf kort en warm, met je.", address: null, examples: ["a", "b", "c"], sampleCount: 7 });
    expect(parseVoiceProfile(JSON.stringify({ summary: "kort" }), 7)).toBeNull();
    expect(parseVoiceProfile("not json", 7)).toBeNull();
  });
});

describe("buildStyleBlock", () => {
  it("uses the learned voice instead of the tone when it is switched on", () => {
    const on = buildStyleBlock({ ...DEFAULT_MERCHANT_SETTINGS, voice_enabled: true, voice_profile: profile });
    expect(on).toContain(profile.summary);
    expect(on).toContain('"je"');
    expect(on).not.toContain("TONE-OF-VOICE");
    const off = buildStyleBlock({ ...DEFAULT_MERCHANT_SETTINGS, voice_enabled: false, voice_profile: profile });
    expect(off).toContain("TONE-OF-VOICE");
    expect(off).not.toContain(profile.summary);
  });

  it("carries the Rules tab", () => {
    const block = buildStyleBlock({ ...DEFAULT_MERCHANT_SETTINGS, custom_rules: ["Noem altijd onze gratis retour"], forbidden_topics: ["rechtszaak"], forbidden_phrases: ["helaas"] });
    expect(block).toContain("EXTRA REGEL: Noem altijd onze gratis retour");
    expect(block).toContain("rechtszaak");
    expect(block).toContain('"helaas"');
  });
});

describe("reply prompts get the shop's style and rules", () => {
  beforeEach(() => {
    state.groq.mockReset();
    state.groq.mockResolvedValue(JSON.stringify({ messageBody: "Komt goed!" }));
  });

  const faq: IIntentStructuredResult = {
    intent: "faq",
    confidence: 0.95,
    extracted_order_number: null,
    language_detected: "nl",
    sentiment: "neutral",
    requires_human: false,
    reasoning: "test",
  };

  it("the general reply prompt contains the voice and the custom rules (they used to reach no prompt)", async () => {
    await new AiService({} as never).buildAutomatedAction({
      incomingText: "Hoe lang duurt verzending naar België?",
      precomputedIntent: faq,
      shopDomain: "s.myshopify.com",
      shopAccessToken: "shpat",
      merchantSettings: { ...DEFAULT_MERCHANT_SETTINGS, voice_enabled: true, voice_profile: profile, custom_rules: ["Noem altijd onze gratis retour"] },
    });
    const prompt = JSON.stringify(state.groq.mock.calls[0]?.[1] ?? "");
    expect(prompt).toContain("één uitroepteken per mail");
    expect(prompt).toContain("Noem altijd onze gratis retour");
  });
});
