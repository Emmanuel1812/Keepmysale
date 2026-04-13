import { GoogleGenerativeAI, type GenerativeModel } from "@google/generative-ai";
import { getEnv } from "@/lib/env";

export const GEMINI_MODELS = {
  PRIMARY: "gemini-2.5-flash",
  FALLBACK: "gemini-2.5-flash-lite",
} as const;

export function createGeminiClient() {
  const env = getEnv();
  if (!env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not defined in environment variables");
  }
  return new GoogleGenerativeAI(env.GEMINI_API_KEY);
}

/**
 * Calls Gemini with exponential backoff for 503/429 errors.
 */
export async function callGeminiWithRetry(
  model: GenerativeModel,
  prompt: string,
  maxRetries = 3
) {
  let lastError: any;
  
  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await model.generateContent(prompt);
    } catch (error: any) {
      lastError = error;
      const isRetryable = error.status === 503 || error.status === 429;
      
      if (!isRetryable || i === maxRetries) break;
      
      const waitTime = Math.pow(2, i) * 1000;
      console.log(`[Gemini] Model ${model.model} busy (503/429). Retrying in ${waitTime}ms... (Attempt ${i + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
  
  throw lastError;
}
