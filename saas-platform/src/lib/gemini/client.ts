import { GoogleGenerativeAI } from "@google/generative-ai";
import { getEnv } from "@/lib/env";

export function createGeminiClient() {
  const env = getEnv();
  if (!env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not defined in environment variables");
  }
  return new GoogleGenerativeAI(env.GEMINI_API_KEY);
}
