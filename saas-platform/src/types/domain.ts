export type ChannelType = "email" | "whatsapp";

export type IntentType =
  | "resend_confirmation"
  | "wismo"
  | "return_request"
  | "general_support"
  | "unknown";

export type SenderRole = "customer" | "assistant" | "human_agent" | "system";

export interface Merchant {
  id: string;
  name: string;
  shopDomain: string;
  supportEmail: string | null;
  plan: "starter" | "growth" | "pro";
  createdAt: string;
}

export interface Conversation {
  id: string;
  merchantId: string;
  externalThreadId: string | null;
  channel: ChannelType;
  customerEmail: string | null;
  status: "open" | "pending" | "resolved";
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  merchantId: string;
  conversationId: string;
  senderRole: SenderRole;
  bodyText: string;
  channel: ChannelType;
  externalMessageId: string | null;
  createdAt: string;
}

export interface IntentResult {
  intent: IntentType;
  confidence: number;
  reason: string;
}

export interface ActionResult {
  action:
    | "send_confirmation"
    | "send_tracking_status"
    | "offer_partial_refund"
    | "request_human_review"
    | "send_general_reply";
  messageBody: string;
  negotiationDecision?: "accept" | "reject" | "continue";
}
