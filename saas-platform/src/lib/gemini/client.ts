import { GoogleGenerativeAI, type GenerativeModel } from "@google/generative-ai";
import { getEnv } from "@/lib/env";

/** gemini-2.0-flash was retired in 2026. GEMINI_MODEL overrides the default in Vercel without a code change. */
export const GEMINI_MODELS = {
  PRIMARY: process.env.GEMINI_MODEL || "gemini-2.5-flash",
} as const;

/** Gemini is optional (Groq is the primary provider): no key means no Gemini client, not a crash. */
export function createGeminiClient(): GoogleGenerativeAI | null {
  const env = getEnv();
  if (!env.GEMINI_API_KEY) return null;
  return new GoogleGenerativeAI(env.GEMINI_API_KEY);
}

/**
 * Calls Gemini with exponential backoff for 503/429 errors.
 * - Attempt 1: immediate
 * - Attempt 2: wait 2s (10s for 429)
 * - Attempt 3: wait 5s (10s for 429)
 */
export async function callGeminiWithRetry(
  model: GenerativeModel,
  prompt: string,
  maxRetries = 2
) {
  let lastError: any;
  const backoffDelays = [0, 2000, 5000]; // ms delays per attempt
  
  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await model.generateContent(prompt);
    } catch (error: any) {
      lastError = error;
      const is429 = error.status === 429;
      const isRetryable = is429 || error.status === 503;
      
      if (!isRetryable || i === maxRetries) break;
      
      const waitTime = is429 ? 10000 : backoffDelays[i + 1] || 5000;
      console.log(`[Gemini] ${is429 ? '429 Rate Limited' : `Error ${error.status}`}. Retrying in ${waitTime}ms... (Attempt ${i + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
  
  throw lastError;
}
