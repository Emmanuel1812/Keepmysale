import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  groqClient: {} as object | null,
  geminiClient: { getGenerativeModel: () => ({}) } as object | null,
  groq: vi.fn(),
  gemini: vi.fn(),
}));

vi.mock("@/lib/ai/groq-client", () => ({
  GROQ_MODELS: { PRIMARY: "openai/gpt-oss-120b", LIGHT: "openai/gpt-oss-20b" },
  createGroqClient: () => state.groqClient,
  callGroqWithRetry: (...args: unknown[]) => state.groq(...args),
}));
vi.mock("@/lib/gemini/client", () => ({
  GEMINI_MODELS: { PRIMARY: "gemini-test" },
  createGeminiClient: () => state.geminiClient,
  callGeminiWithRetry: (...args: unknown[]) => state.gemini(...args),
}));
vi.mock("@/services/order-service", () => ({ OrderService: class {} }));

import { AiService } from "@/services/ai-service";

const FAQ = JSON.stringify({ intent: "faq", confidence: 0.91, extracted_order_number: null, language_detected: "nl", sentiment: "neutral", requires_human: false, reasoning: "x" });
// No order number and no return words, so the regex shortcuts do not fire and the AI is asked
const classify = () => new AiService({} as never).classifyIntent("Hoi, vallen jullie jassen klein of normaal?");

describe("AI provider order", () => {
  beforeEach(() => {
    state.groqClient = {};
    state.geminiClient = { getGenerativeModel: () => ({}) };
    state.groq.mockReset();
    state.gemini.mockReset();
  });

  it("asks Groq's production model first and stops there when it answers", async () => {
    state.groq.mockResolvedValue(FAQ);
    const result = await classify();
    expect(result.intent).toBe("faq");
    expect(state.groq).toHaveBeenCalledTimes(1);
    expect(state.groq.mock.calls[0][2]).toBe("openai/gpt-oss-120b");
    expect(state.gemini).not.toHaveBeenCalled();
  });

  it("falls back to Groq's light model, then to Gemini", async () => {
    state.groq.mockRejectedValue(Object.assign(new Error("model_decommissioned"), { status: 400 }));
    state.gemini.mockResolvedValue({ response: { text: () => FAQ } });
    const result = await classify();
    expect(state.groq.mock.calls.map((c) => c[2])).toEqual(["openai/gpt-oss-120b", "openai/gpt-oss-20b"]);
    expect(state.gemini).toHaveBeenCalledTimes(1);
    expect(result.intent).toBe("faq");
  });

  it("works with only a Groq key (no Gemini key no longer crashes the service)", async () => {
    state.geminiClient = null;
    state.groq.mockResolvedValue(FAQ);
    expect((await classify()).intent).toBe("faq");
  });

  it("with no provider at all, classification hands the mail to a person instead of guessing", async () => {
    state.groqClient = null;
    state.geminiClient = null;
    const result = await classify();
    expect(result).toMatchObject({ intent: "other", requires_human: true });
  });
});
