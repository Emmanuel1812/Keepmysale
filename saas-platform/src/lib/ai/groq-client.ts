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
 */
export async function callGroqWithRetry(
  client: OpenAI,
  messages: any[],
  model = GROQ_MODELS.PRIMARY,
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
      const isRetryable = error.status === 503 || error.status === 429 || error.status === 500;
      
      if (!isRetryable || i === maxRetries) break;
      
      const waitTime = Math.pow(2, i) * 1000;
      console.log(`[Groq] Model ${model} busy/error. Retrying in ${waitTime}ms... (Attempt ${i + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
  
  throw lastError;
}
