import type { IntentResult } from "@/types/domain";
import { classifyIntentWithLlm } from "@/lib/openai/classifier";

const resendPatterns = [
  /resend.*confirmation/i,
  /didn'?t receive.*confirmation/i,
  /nao recebi.*confirmacao/i,
  /não recebi.*confirmação/i,
  /geen bevestigingsmail ontvangen/i,
  /bevestiging.*opnieuw sturen/i,
];

const wismoPatterns = [/where.*order/i, /tracking/i, /status.*order/i, /onde.*encomenda/i];
const returnPatterns = [/return/i, /refund/i, /damaged/i, /troca/i, /devolver/i];

export async function classifyIntent(text: string): Promise<IntentResult> {
  if (resendPatterns.some((pattern) => pattern.test(text))) {
    return {
      intent: "resend_confirmation",
      confidence: 0.98,
      reason: "Matched resend confirmation patterns from Python baseline.",
    };
  }

  if (wismoPatterns.some((pattern) => pattern.test(text))) {
    return {
      intent: "wismo",
      confidence: 0.95,
      reason: "Matched WISMO patterns from baseline heuristics.",
    };
  }

  if (returnPatterns.some((pattern) => pattern.test(text))) {
    return {
      intent: "return_request",
      confidence: 0.9,
      reason: "Matched return/refund negotiation patterns from baseline heuristics.",
    };
  }

  if (text.trim().length > 0) {
    return {
      intent: "general_support",
      confidence: 0.7,
      reason: "Defaulted to general support fallback.",
    };
  }

  try {
    return await classifyIntentWithLlm(text);
  } catch {
    return {
      intent: "unknown",
      confidence: 0.2,
      reason: "Fallback intent when AI classifier is unavailable.",
    };
  }
}
