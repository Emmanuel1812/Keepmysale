import type { IIntentStructuredResult } from "@/types/ai";
import type { IMerchantSettings } from "@/types/merchant";

export interface ReplyDecision {
  /** The merchant's settings allow an automatic answer for this kind of mail. */
  autoReplyEnabled: boolean;
  /** The classifier was less sure than the merchant's threshold. */
  belowThreshold: boolean;
  /** A return request that the negotiation flow takes over. */
  isNegotiation: boolean;
  /** true = save as a draft for a person; false = send. */
  skipAutoReply: boolean;
}

/**
 * Send or draft, for the FIRST message of a conversation. The live pipeline (webhook-service) and the inbox replay
 * both use this, so the replay shows exactly what the product would have done.
 * (An active negotiation later in a thread also forces sending; that is decided in webhook-service.)
 */
export function decideAutoReply(classification: IIntentStructuredResult, settings: IMerchantSettings): ReplyDecision {
  const intentAutoReplyMap: Record<string, boolean> = {
    wismo: settings.auto_reply_wismo !== false,
    return: settings.auto_negotiate !== false,
    complaint: settings.auto_reply_complaint === true,
    other: settings.auto_reply_general !== false,
    faq: settings.auto_reply_general !== false,
    exchange: settings.auto_reply_general !== false,
    resend_confirmation: settings.auto_reply_wismo !== false,
  };
  const autoReplyEnabled = intentAutoReplyMap[classification.intent] ?? settings.auto_reply_general !== false;

  const confidenceThreshold = settings.requires_human_threshold ?? 0.6;
  const belowThreshold = classification.confidence < confidenceThreshold;

  const isNegotiation = classification.intent === "return" && settings.auto_negotiate !== false;
  let skipAutoReply = !autoReplyEnabled || classification.requires_human || belowThreshold;

  // Informational intents always send (never draft)
  if (
    classification.intent === "wismo" ||
    classification.intent === "faq" ||
    classification.intent === "resend_confirmation"
  ) {
    skipAutoReply = false;
  }

  // A return request goes to the negotiation flow, which answers itself
  if (isNegotiation) skipAutoReply = false;

  return { autoReplyEnabled, belowThreshold, isNegotiation, skipAutoReply };
}
