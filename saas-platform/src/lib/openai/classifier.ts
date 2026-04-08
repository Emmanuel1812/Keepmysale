import type { IntentResult } from "@/types/domain";
import { createOpenAiClient } from "@/lib/openai/client";
import { INTENT_SYSTEM_PROMPT } from "@/lib/openai/prompts";

export async function classifyIntentWithLlm(inputText: string): Promise<IntentResult> {
  const client = createOpenAiClient();
  const response = await client.responses.create({
    model: "gpt-4o-mini",
    temperature: 0.1,
    input: [
      { role: "system", content: INTENT_SYSTEM_PROMPT },
      { role: "user", content: inputText },
    ],
  });
  return JSON.parse(response.output_text) as IntentResult;
}
