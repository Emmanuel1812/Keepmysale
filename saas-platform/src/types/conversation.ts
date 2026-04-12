export type TConversationChannel = "whatsapp" | "email";
export type TConversationIntent =
  | "wismo"
  | "return"
  | "exchange"
  | "faq"
  | "complaint"
  | "other";
export type TConversationStatus =
  | "open"
  | "pending_ai"
  | "pending_human"
  | "negotiating"
  | "resolved"
  | "closed";

export interface IConversation {
  id: string;
  merchantId: string;
  customerId: string;
  channel: TConversationChannel;
  status: TConversationStatus;
  subject: string | null;
  intent: TConversationIntent | null;
  assignedTo: string | null;
  aiResolved: boolean;
  shopifyOrderId: string | null;
  lastMessageAt: string;
  lastMessageSenderType?: string | null;
  resolvedAt: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface IConversationCreate {
  merchantId: string;
  customerId: string;
  channel: TConversationChannel;
  status?: TConversationStatus;
  subject?: string | null;
  intent?: TConversationIntent | null;
  assignedTo?: string | null;
  aiResolved?: boolean;
  shopifyOrderId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface IConversationUpdate {
  status?: TConversationStatus;
  intent?: TConversationIntent | null;
  assignedTo?: string | null;
  aiResolved?: boolean;
  resolvedAt?: string | null;
  metadata?: Record<string, unknown>;
}

export interface IConversationFilters {
  merchantId: string;
  customerId?: string;
  channel?: TConversationChannel;
  status?: TConversationStatus;
  intent?: TConversationIntent;
  assignedTo?: string;
  limit?: number;
  offset?: number;
}
