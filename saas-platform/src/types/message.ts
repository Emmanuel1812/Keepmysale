import type { TConversationChannel } from "@/types/conversation";

export type TMessageSender = "customer" | "ai" | "human_agent" | "system" | "ai_draft";

export interface IMessage {
  id: string;
  conversationId: string;
  merchantId: string;
  sender: TMessageSender;
  channel: TConversationChannel;
  content: string;
  contentHtml: string | null;
  externalMessageId: string | null;
  attachments: Array<Record<string, unknown>>;
  aiConfidence: number | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  isScheduled: boolean;
  scheduledSendAt: string | null;
}

export interface IMessageCreate {
  conversationId: string;
  merchantId: string;
  sender: TMessageSender;
  channel: TConversationChannel;
  content: string;
  contentHtml?: string | null;
  externalMessageId?: string | null;
  attachments?: Array<Record<string, unknown>>;
  aiConfidence?: number | null;
  metadata?: Record<string, unknown>;
  isScheduled?: boolean;
  scheduledSendAt?: string | null;
}

export interface IMessageUpdate {
  content?: string;
  contentHtml?: string | null;
  metadata?: Record<string, unknown>;
  isScheduled?: boolean;
  sender?: TMessageSender;
}
