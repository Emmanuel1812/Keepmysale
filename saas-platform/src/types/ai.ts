export type TIntent =
  | "wismo"
  | "return"
  | "exchange"
  | "faq"
  | "complaint"
  | "other"
  | "resend_confirmation";

export interface IIntentClassification {
  intent: TIntent;
  confidence: number;
  reason: string;
}

export interface IIntentStructuredResult {
  intent: TIntent | "resend_confirmation";
  confidence: number;
  extracted_order_number: string | null;
  language_detected: "nl" | "en" | "pt" | "other";
  sentiment: "negative" | "neutral" | "positive";
  requires_human: boolean;
  reasoning: string;
}

export interface IAiResponse {
  message: string;
  confidence: number;
  escalated: boolean;
}

export interface IAiClassifyRequest {
  merchantId: string;
  conversationId?: string;
  message: string;
}
