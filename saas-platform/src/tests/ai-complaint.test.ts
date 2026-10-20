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

import { AiService } from "@/services/ai-service";
import { DEFAULT_MERCHANT_SETTINGS } from "@/types/merchant";
import type { IIntentStructuredResult } from "@/types/ai";

const complaint: IIntentStructuredResult = {
  intent: "complaint",
  confidence: 0.92,
  extracted_order_number: null,
  language_detected: "nl",
  sentiment: "negative",
  requires_human: false,
  reasoning: "test",
};

describe("complaints", () => {
  beforeEach(() => {
    state.groq.mockReset();
    state.groq.mockResolvedValue(JSON.stringify({ messageBody: "Wat vervelend dat je een groene trui kreeg. Stuur je een foto? Dan sturen we de blauwe." }));
  });

  it("get a written reply that names the problem, not the canned 'we received your request'", async () => {
    const action = await new AiService({} as never).buildAutomatedAction({
      incomingText: "Ik heb een blauwe trui besteld maar kreeg een groene. Kunnen jullie dit oplossen?",
      precomputedIntent: complaint,
      shopDomain: "s.myshopify.com",
      shopAccessToken: "shpat",
      merchantSettings: { ...DEFAULT_MERCHANT_SETTINGS },
    });
    expect(action.messageBody).toContain("groene trui");
    expect(action.messageBody).not.toContain("aanvraag ontvangen");
    const prompt = JSON.stringify(state.groq.mock.calls[0]?.[1] ?? "");
    expect(prompt).toContain("KLACHT");
    expect(prompt).toContain("Beloof NOOIT een bedrag");
  });
});
