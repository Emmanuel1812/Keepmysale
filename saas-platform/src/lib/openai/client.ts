import OpenAI from "openai";
import { getEnv } from "@/lib/env";

export function createOpenAiClient() {
  const env = getEnv();
  return new OpenAI({ apiKey: env.OPENAI_API_KEY });
}
