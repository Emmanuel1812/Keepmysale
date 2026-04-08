import type { TConversationChannel } from "@/types/conversation";

export type TMessageSender = "customer" | "ai" | "human_agent" | "system";

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
}

export interface IMessageUpdate {
  content?: string;
  contentHtml?: string | null;
  metadata?: Record<string, unknown>;
}
