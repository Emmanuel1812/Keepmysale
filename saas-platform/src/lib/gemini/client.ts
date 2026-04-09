import { GoogleGenerativeAI } from "@google/generative-ai";
import { getEnv } from "@/lib/env";

export function createGeminiClient() {
  const env = getEnv();
  return new GoogleGenerativeAI(env.GEMINI_API_KEY);
}
