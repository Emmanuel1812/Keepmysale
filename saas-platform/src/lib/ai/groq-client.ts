import OpenAI from "openai";
import { getEnv } from "@/lib/env";

/**
 * Groq retired llama-3.3-70b-versatile and llama-3.1-8b-instant for non-enterprise accounts on 16 Aug 2026
 * (console.groq.com/docs/deprecations); every call then failed and customers got the canned fallback text.
 * Defaults are Groq's production replacements; GROQ_MODEL / GROQ_MODEL_LIGHT override them in Vercel when Groq
 * retires these too, without a code change.
 */
export const GROQ_MODELS = {
  PRIMARY: process.env.GROQ_MODEL || "openai/gpt-oss-120b",
  LIGHT: process.env.GROQ_MODEL_LIGHT || "openai/gpt-oss-20b",
} as const;

export function createGroqClient() {
  const env = getEnv();
  if (!env.GROQ_API_KEY) {
    return null;
  }

  return new OpenAI({
    apiKey: env.GROQ_API_KEY,
    baseURL: "https://api.groq.com/openai/v1",
  });
}

/**
 * Calls Groq with exponential backoff for 503/429 errors.
 * Defaults to LIGHT model for higher rate limits.
 * Falls back to the other model if all retries fail.
 */
export async function callGroqWithRetry(
  client: OpenAI,
  messages: any[],
  model: string = GROQ_MODELS.LIGHT,
  maxRetries = 1
) {
  let lastError: any;
  
  for (let i = 0; i <= maxRetries; i++) {
    try {
      const completion = await client.chat.completions.create({
        messages,
        model,
        response_format: { type: "json_object" },
        // gpt-oss models reason before answering; support replies do not need long reasoning
        ...(model.startsWith("openai/gpt-oss") ? { reasoning_effort: "low" } : {}),
      } as Parameters<typeof client.chat.completions.create>[0]) as { choices: Array<{ message: { content: string | null } }> };
      return completion.choices[0].message.content;
    } catch (error: any) {
      lastError = error;
      const is429 = error.status === 429;
      // On 429 don't retry at all
      if (is429) {
        console.log(`[Groq] 429 Rate Limited. Not retrying.`);
        break; 
      }

      const isRetryable = error.status === 503 || error.status === 500;
      
      if (!isRetryable || i === maxRetries) break;
      
      const waitTime = Math.pow(2, i) * 1000;
      console.log(`[Groq] Error ${error.status}. Retrying in ${waitTime}ms... (Attempt ${i + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
  
  throw lastError;
}
