import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  groq: vi.fn(),
  findByMerchant: vi.fn(),
  fetchShopify: vi.fn(),
}));

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
    findByMerchant = state.findByMerchant;
    fetchShopifyOrderByName = state.fetchShopify;
  },
}));

import { AiService } from "@/services/ai-service";
import { DEFAULT_MERCHANT_SETTINGS } from "@/types/merchant";
import type { IIntentStructuredResult } from "@/types/ai";

const wismo: IIntentStructuredResult = {
  intent: "wismo",
  confidence: 0.96,
  extracted_order_number: "#1005",
  language_detected: "nl",
  sentiment: "neutral",
  requires_human: false,
  reasoning: "test",
};

const localOrder = {
  id: "o5",
  shopifyOrderNumber: "#1005",
  financialStatus: "paid",
  fulfillmentStatus: "fulfilled",
  trackingNumber: "26564613",
  totalPrice: "885.95",
  lineItems: [{ quantity: 1, title: "The Collection Snowboard: Liquid" }],
};

const build = (merchantId?: string) =>
  new AiService({} as never).buildAutomatedAction({
    incomingText: "Hoi, waar is mijn bestelling #1005?",
    precomputedIntent: wismo,
    shopDomain: "s.myshopify.com",
    shopAccessToken: "shpat",
    merchantSettings: { ...DEFAULT_MERCHANT_SETTINGS },
    merchantId,
  });

const promptSent = () => JSON.stringify(state.groq.mock.calls[0]?.[1] ?? "");

describe("order lookup for AI replies", () => {
  beforeEach(() => {
    state.groq.mockReset();
    state.groq.mockResolvedValue(JSON.stringify({ messageBody: "Je pakket is onderweg." }));
    state.findByMerchant.mockReset();
    state.fetchShopify.mockReset();
  });

  it("uses the merchant's own synced order (older than Shopify's 60-day window) with its tracking number", async () => {
    state.findByMerchant.mockResolvedValue([localOrder]);
    await build("m1");
    expect(state.findByMerchant).toHaveBeenCalledWith("m1");
    expect(state.fetchShopify).not.toHaveBeenCalled();
    expect(promptSent()).toContain("26564613");
    expect(promptSent()).not.toContain("Geen order gevonden");
  });

  it("asks Shopify only when the order is not in the synced orders", async () => {
    state.findByMerchant.mockResolvedValue([]);
    state.fetchShopify.mockResolvedValue(null);
    await build("m1");
    expect(state.fetchShopify).toHaveBeenCalledTimes(1);
  });

  it("still answers when the Shopify lookup fails", async () => {
    state.findByMerchant.mockResolvedValue([]);
    state.fetchShopify.mockRejectedValue(new Error("Shopify order fetch failed with 401"));
    const action = await build("m1");
    expect(action.messageBody).toBe("Je pakket is onderweg.");
  });
});
