import { describe, expect, it, vi } from "vitest";
import { isClearAcceptance, withinOfferMemory } from "@/lib/automation/acceptance";

describe("isClearAcceptance", () => {
  it.each(["Ja", "Ok, prima!", "Akkoord", "Graag!", "Deal", "Ja hoor, doe maar", "Yes, I'll take it", "Sounds good"])(
    "short yes: %s",
    (text) => expect(isClearAcceptance(text)).toBe(true),
  );

  it.each([
    // the live case of 20 Oct 2026: a new return request was read as accepting an old 50% offer
    "Hoi, Ik heb vorige week order #1004 ontvangen, de Multi-managed Snowboard. Hij is mooi, maar toch niet helemaal wat ik zocht. Ik wil hem graag retourneren en mijn geld terug. Hoe gaat dat?",
    "Ik wil graag mijn geld terug",
    "Nee, ik wil liever retourneren",
    "Ok maar ik wil hem toch terugsturen",
    "Ja maar niet voor 20%",
    "I would rather return it",
    "Ok, full refund please",
  ])("not an acceptance: %s", (text) => expect(isClearAcceptance(text)).toBe(false));
});

describe("withinOfferMemory", () => {
  const now = new Date("2026-10-20T20:00:00Z").getTime();
  it("keeps the last two weeks and drops a June offer", () => {
    expect(withinOfferMemory("2026-10-15T10:00:00Z", now)).toBe(true);
    expect(withinOfferMemory("2026-06-13T19:39:00Z", now)).toBe(false);
  });
});

// The whole reply path with the AI down (the fallback that sent "50% confirmed")
vi.mock("@/lib/gemini/client", () => ({
  GEMINI_MODELS: { PRIMARY: "g" },
  createGeminiClient: () => null,
  callGeminiWithRetry: vi.fn(),
}));
vi.mock("@/lib/ai/groq-client", () => ({
  GROQ_MODELS: { PRIMARY: "a", LIGHT: "b" },
  createGroqClient: () => null,
  callGroqWithRetry: vi.fn(),
}));
vi.mock("@/services/order-service", () => ({
  OrderService: class {
    findByMerchant = async () => [];
    fetchShopifyOrderByName = async () => null;
  },
}));

import { AiService } from "@/services/ai-service";
import { DEFAULT_MERCHANT_SETTINGS } from "@/types/merchant";

describe("a new return request in a thread that once had a 50% offer", () => {
  it("is not confirmed as an accepted refund", async () => {
    const action = await new AiService({} as never).buildAutomatedAction({
      incomingText: "Ik wil hem graag retourneren en mijn geld terug. Hoe gaat dat?",
      history: [{ role: "assistant", content: "Ik bied u graag 50% van uw aankoop als store credit aan." }],
      precomputedIntent: {
        intent: "return", confidence: 0.96, extracted_order_number: "#1004", language_detected: "nl",
        sentiment: "negative", requires_human: false, reasoning: "t",
      },
      shopDomain: "s.myshopify.com",
      shopAccessToken: "",
      merchantSettings: { ...DEFAULT_MERCHANT_SETTINGS },
    });
    expect(action.negotiationDecision).not.toBe("accept");
    expect(action.messageBody).not.toMatch(/bevestigd/);
  });
});
