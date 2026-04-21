import OpenAI from "openai";
import { getEnv } from "@/lib/env";

export const GROQ_MODELS = {
  PRIMARY: "llama-3.3-70b-versatile",
  LIGHT: "llama-3.1-8b-instant",
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
  maxRetries = 2
) {
  let lastError: any;
  
  for (let i = 0; i <= maxRetries; i++) {
    try {
      const completion = await client.chat.completions.create({
        messages,
        model,
        response_format: { type: "json_object" },
      });
      return completion.choices[0].message.content;
    } catch (error: any) {
      lastError = error;
      const is429 = error.status === 429;
      const isRetryable = is429 || error.status === 503 || error.status === 500;
      
      if (!isRetryable || i === maxRetries) break;
      
      const waitTime = is429 ? 10000 : Math.pow(2, i) * 1000;
      console.log(`[Groq] ${is429 ? '429 Rate Limited' : `Error ${error.status}`}. Retrying in ${waitTime}ms... (Attempt ${i + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
  
  // If primary model failed, try light model as last resort
  if (model !== GROQ_MODELS.LIGHT) {
    console.log("[Groq] Falling back to LIGHT model...");
    try {
      const completion = await client.chat.completions.create({
        messages,
        model: GROQ_MODELS.LIGHT,
        response_format: { type: "json_object" },
      });
      return completion.choices[0].message.content;
    } catch (fallbackError) {
      console.error("[Groq] LIGHT fallback also failed:", fallbackError);
    }
  }
  
  throw lastError;
}
