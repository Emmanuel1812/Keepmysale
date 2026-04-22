import type { SupabaseClient } from "@supabase/supabase-js";
import type { IMessage, IMessageCreate, IMessageUpdate } from "@/types/message";

type MessageRow = Record<string, unknown>;

function mapMessageRow(row: MessageRow): IMessage {
  return {
    id: String(row.id),
    conversationId: String(row.conversation_id),
    merchantId: String(row.merchant_id),
    sender: row.sender as IMessage["sender"],
    channel: row.channel as IMessage["channel"],
    content: String(row.content),
    contentHtml: (row.content_html as string | null) ?? null,
    externalMessageId: (row.external_message_id as string | null) ?? null,
    attachments: ((row.attachments as Array<Record<string, unknown>> | null) ?? []) as Array<
      Record<string, unknown>
    >,
    aiConfidence: (row.ai_confidence as number | null) ?? null,
    metadata: ((row.metadata as Record<string, unknown> | null) ?? {}) as Record<string, unknown>,
    createdAt: String(row.created_at),
    isScheduled: Boolean(row.is_scheduled ?? false),
    scheduledSendAt: (row.scheduled_send_at as string | null) ?? null,
  };
}

export class MessagesDal {
  constructor(private readonly supabase: SupabaseClient) {}

  async findById(id: string): Promise<IMessage | null> {
    const { data, error } = await this.supabase.from("messages").select("*").eq("id", id).single();
    if (error || !data) return null;
    return mapMessageRow(data as MessageRow);
  }

  async findByMerchant(merchantId: string): Promise<IMessage[]> {
    const { data, error } = await this.supabase
      .from("messages")
      .select("*")
      .eq("merchant_id", merchantId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((row) => mapMessageRow(row as MessageRow));
  }

  async findByConversation(conversationId: string): Promise<IMessage[]> {
    const { data, error } = await this.supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data ?? []).map((row) => mapMessageRow(row as MessageRow));
  }

  async findByExternalMessageId(
    merchantId: string,
    externalMessageId: string,
  ): Promise<IMessage | null> {
    const { data, error } = await this.supabase
      .from("messages")
      .select("*")
      .eq("merchant_id", merchantId)
      .eq("external_message_id", externalMessageId)
      .maybeSingle();
    if (error || !data) return null;
    return mapMessageRow(data as MessageRow);
  }

  async create(input: IMessageCreate): Promise<IMessage> {
    const { data, error } = await this.supabase
      .from("messages")
      .insert({
        conversation_id: input.conversationId,
        merchant_id: input.merchantId,
        sender: input.sender,
        channel: input.channel,
        content: input.content,
        content_html: input.contentHtml ?? null,
        external_message_id: input.externalMessageId ?? null,
        attachments: input.attachments ?? [],
        ai_confidence: input.aiConfidence ?? null,
        metadata: input.metadata ?? {},
        is_scheduled: input.isScheduled ?? false,
        scheduled_send_at: input.scheduledSendAt ?? null,
      })
      .select("*")
      .single();
    if (error || !data) throw error ?? new Error("Could not create message");
    return mapMessageRow(data as MessageRow);
  }

  async update(id: string, input: IMessageUpdate): Promise<IMessage> {
    const { data, error } = await this.supabase
      .from("messages")
      .update({
        content: input.content,
        content_html: input.contentHtml,
        metadata: input.metadata,
        is_scheduled: input.isScheduled,
        sender: input.sender,
      })
      .eq("id", id)
      .select("*")
      .single();
    if (error || !data) throw error ?? new Error("Could not update message");
    return mapMessageRow(data as MessageRow);
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.supabase.from("messages").delete().eq("id", id);
    if (error) throw error;
  }
}
