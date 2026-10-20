import { describe, expect, it, vi } from "vitest";

// Every AI call fails, as it does when the Gemini key is revoked and no Groq key is set
vi.mock("@/lib/gemini/client", () => ({
  GEMINI_MODELS: { PRIMARY: "gemini-test" },
  createGeminiClient: () => ({ getGenerativeModel: () => ({}) }),
  callGeminiWithRetry: async () => {
    throw new Error("API key not valid");
  },
}));
vi.mock("@/lib/ai/groq-client", () => ({
  GROQ_MODELS: { PRIMARY: "x", LIGHT: "y" },
  createGroqClient: () => null,
  callGroqWithRetry: async () => {
    throw new Error("no groq");
  },
}));
vi.mock("@/services/order-service", () => ({
  OrderService: class {
    fetchShopifyOrderByName = async () => null;
  },
}));

import { AiService } from "@/services/ai-service";
import { DEFAULT_MERCHANT_SETTINGS } from "@/types/merchant";
import type { IIntentStructuredResult } from "@/types/ai";

const returnIntent: IIntentStructuredResult = {
  intent: "return",
  confidence: 0.96,
  extracted_order_number: "#1004",
  language_detected: "nl",
  sentiment: "negative",
  requires_human: false,
  reasoning: "test",
};

const build = (history: Array<{ role: "user" | "assistant"; content: string }>) =>
  new AiService({} as never).buildAutomatedAction({
    incomingText: "Ik wil order #1004 retourneren en mijn geld terug.",
    history,
    precomputedIntent: returnIntent,
    shopDomain: "s.myshopify.com",
    shopAccessToken: "",
    merchantSettings: { ...DEFAULT_MERCHANT_SETTINGS },
  });

describe("negotiation fallback when the AI is unavailable", () => {
  it("makes a first offer as a first offer, not as an answer to an earlier one", async () => {
    const action = await build([]);
    expect(action.messageBody).toContain("20%");
    expect(action.messageBody).not.toMatch(/eerdere aanbod/);
    // the customer's right to simply return stays on the table
    expect(action.messageBody).toMatch(/retourneren/);
  });

  it("still steps up after an earlier offer was declined", async () => {
    const action = await build([
      { role: "user", content: "Ik wil retourneren." },
      { role: "assistant", content: "We bieden je 20% terugbetaling aan." },
    ]);
    expect(action.messageBody).toContain("35%");
    expect(action.messageBody).toMatch(/eerdere aanbod/);
  });
});
