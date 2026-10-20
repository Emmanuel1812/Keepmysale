import { beforeEach, describe, expect, it, vi } from "vitest";
import { ensureReturnOption, isOpenOffer, statesReturnOption, stripSalutations } from "@/lib/automation/offer-safety";

describe("ensureReturnOption", () => {
  it("adds the plain return option to an offer that leaves it out", () => {
    const { message, added } = ensureReturnOption("We bieden je 20% terug als je het houdt.", "nl");
    expect(added).toBe(true);
    expect(message).toMatch(/Liever terugsturen\? Dat kan altijd/);
    expect(statesReturnOption(message)).toBe(true);
  });

  it("does not repeat it when the offer already says so", () => {
    const text = "Je mag het houden met 20% korting, of terugsturen voor het volledige bedrag.";
    expect(ensureReturnOption(text, "nl")).toEqual({ message: text, added: false });
  });

  it("uses the customer's language", () => {
    expect(ensureReturnOption("We offer 20% back.", "en").message).toMatch(/full purchase price/);
  });
});

describe("stripSalutations", () => {
  it("drops the model's own greeting and sign-off (the formatter adds the store's)", () => {
    const text = "Goedemiddag Emmanuel,\n\nWe bieden je 20% terug.\n\nMet vriendelijke groet,\nKlantenservice efo-testing-store";
    expect(stripSalutations(text)).toBe("We bieden je 20% terug.");
  });

  it("leaves a body without salutations alone, including words like 'groeten' mid-sentence", () => {
    const text = "Je pakket is verzonden.\nDe vervoerder doet de groeten niet, maar levert morgen.";
    expect(stripSalutations(text)).toBe(text);
  });
});

describe("isOpenOffer", () => {
  it("is an offer still waiting for the customer, with a percentage", () => {
    expect(isOpenOffer({ action: "offer_partial_refund", negotiationDecision: "next_step" }, "20% terug")).toBe(true);
    expect(isOpenOffer({ action: "offer_partial_refund", negotiationDecision: "accept" }, "20% bevestigd")).toBe(false);
    expect(isOpenOffer({ action: "offer_partial_refund", negotiationDecision: "reject" }, "een collega")).toBe(false);
    expect(isOpenOffer({ action: "send_general_reply" }, "20% korting op je volgende order")).toBe(false);
  });
});

// The reply builder: offers end with the return option, and order questions without an order are not grounded
const state = vi.hoisted(() => ({ groq: vi.fn(), local: [] as unknown[] }));
vi.mock("@/lib/ai/groq-client", () => ({
  GROQ_MODELS: { PRIMARY: "a", LIGHT: "b" },
  createGroqClient: () => ({}),
  callGroqWithRetry: (...args: unknown[]) => state.groq(...args),
}));
vi.mock("@/lib/gemini/client", () => ({ GEMINI_MODELS: { PRIMARY: "g" }, createGeminiClient: () => null, callGeminiWithRetry: vi.fn() }));
vi.mock("@/services/order-service", () => ({
  OrderService: class {
    findByMerchant = async () => state.local;
    fetchShopifyOrderByName = async () => null;
  },
}));

import { AiService } from "@/services/ai-service";
import { DEFAULT_MERCHANT_SETTINGS } from "@/types/merchant";
import type { IIntentStructuredResult } from "@/types/ai";

const intent = (i: IIntentStructuredResult["intent"], order: string | null): IIntentStructuredResult => ({
  intent: i, confidence: 0.95, extracted_order_number: order, language_detected: "nl", sentiment: "neutral", requires_human: false, reasoning: "t",
});
const build = (text: string, it: IIntentStructuredResult) =>
  new AiService({} as never).buildAutomatedAction({
    incomingText: text, precomputedIntent: it, shopDomain: "s.myshopify.com", shopAccessToken: "",
    merchantSettings: { ...DEFAULT_MERCHANT_SETTINGS }, merchantId: "m1",
  });

describe("reply builder safety", () => {
  beforeEach(() => {
    state.groq.mockReset();
    state.local = [{ id: "o4", shopifyOrderNumber: "#1004", financialStatus: "paid", fulfillmentStatus: "fulfilled", trackingNumber: "0044", totalPrice: "629.95", currency: "USD", lineItems: [] }];
  });

  it("ends an AI offer with the return option even when the model left it out", async () => {
    state.groq.mockResolvedValue(JSON.stringify({ messageBody: "Je kunt het houden en we storten 20% terug. Zou dat werken?", negotiationDecision: "next_step" }));
    const action = await build("Ik wil order #1004 retourneren", intent("return", "#1004"));
    expect(action.returnOptionStated).toBe(true);
    expect(action.messageBody).toMatch(/volledige aankoopbedrag terug/);
  });

  it("records the order facts, in the order's own currency and without raw Shopify words", async () => {
    state.groq.mockResolvedValue(JSON.stringify({ messageBody: "Je pakket is verzonden." }));
    const action = await build("Waar is #1004?", intent("wismo", "#1004"));
    expect(action.grounded).toBe(true);
    expect(action.facts).toEqual(expect.arrayContaining(["Order #1004", "Tracking 0044", "Totaal 629.95 USD"]));
    const prompt = JSON.stringify(state.groq.mock.calls[0][1]);
    expect(prompt).not.toMatch(/Fulfillment Status|fulfilled/);
  });

  it("is not grounded when the order cannot be found", async () => {
    state.local = [];
    state.groq.mockResolvedValue(JSON.stringify({ messageBody: "We kunnen je bestelling niet vinden." }));
    const action = await build("Waar is #9999?", intent("wismo", "#9999"));
    expect(action.grounded).toBe(false);
  });

  it("a general question needs no order", async () => {
    state.groq.mockResolvedValue(JSON.stringify({ messageBody: "Onze jassen vallen normaal." }));
    expect((await build("Vallen jullie jassen klein?", intent("faq", null))).grounded).toBe(true);
  });
});
