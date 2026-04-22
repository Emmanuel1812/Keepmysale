import type { SupabaseClient } from "@supabase/supabase-js";
import type { IConversation, IConversationCreate, IConversationUpdate } from "@/types/conversation";

type ConversationRow = Record<string, unknown>;

function mapConversationRow(row: ConversationRow): IConversation {
  return {
    id: String(row.id),
    merchantId: String(row.merchant_id),
    customerId: String(row.customer_id),
    channel: row.channel as IConversation["channel"],
    status: row.status as IConversation["status"],
    subject: (row.subject as string | null) ?? null,
    intent: (row.intent as IConversation["intent"] | null) ?? null,
    category: (row.category as string | null) ?? null,
    assignedTo: (row.assigned_to as string | null) ?? null,
    aiResolved: Boolean(row.ai_resolved),
    shopifyOrderId: (row.shopify_order_id as string | null) ?? null,
    lastMessageAt: String(row.last_message_at),
    lastMessageSenderType: (row.last_message_sender_type as string | null) ?? null,
    lastMessageContent: (row.last_message_content as string | null) ?? null,
    resolvedAt: (row.resolved_at as string | null) ?? null,
    metadata: ((row.metadata as Record<string, unknown> | null) ?? {}) as Record<string, unknown>,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export class ConversationsDal {
  constructor(private readonly supabase: SupabaseClient) {}

  async findById(id: string): Promise<IConversation | null> {
    const { data, error } = await this.supabase.from("conversations").select("*").eq("id", id).single();
    if (error || !data) return null;
    return mapConversationRow(data as ConversationRow);
  }

  async findByMerchant(merchantId: string): Promise<IConversation[]> {
    const { data, error } = await this.supabase
      .from("conversations")
      .select("*")
      .eq("merchant_id", merchantId)
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((row) => mapConversationRow(row as ConversationRow));
  }

  async findOrCreate(input: IConversationCreate): Promise<IConversation> {
    const { data, error } = await this.supabase
      .from("conversations")
      .select("*")
      .eq("merchant_id", input.merchantId)
      .eq("customer_id", input.customerId)
      .eq("channel", input.channel)
      .in("status", ["open", "pending_ai", "pending_human", "negotiating"])
      .order("updated_at", { ascending: false })
      .limit(1);
    if (error) throw error;
    const existing = (data ?? [])[0];
    if (existing) {
      return mapConversationRow(existing as ConversationRow);
    }
    return this.create(input);
  }

  async create(input: IConversationCreate): Promise<IConversation> {
    const { data, error } = await this.supabase
      .from("conversations")
      .insert({
        merchant_id: input.merchantId,
        customer_id: input.customerId,
        channel: input.channel,
        status: input.status ?? "open",
        subject: input.subject ?? null,
        intent: input.intent ?? null,
        category: input.category ?? null,
        assigned_to: input.assignedTo ?? null,
        ai_resolved: input.aiResolved ?? false,
        shopify_order_id: input.shopifyOrderId ?? null,
        metadata: input.metadata ?? {},
      })
      .select("*")
      .single();
    if (error || !data) throw error ?? new Error("Could not create conversation");
    return mapConversationRow(data as ConversationRow);
  }

  async update(id: string, input: IConversationUpdate): Promise<IConversation> {
    const { data, error } = await this.supabase
      .from("conversations")
      .update({
        status: input.status,
        intent: input.intent,
        category: input.category,
        assigned_to: input.assignedTo,
        ai_resolved: input.aiResolved,
        resolved_at: input.resolvedAt,
        metadata: input.metadata,
      })
      .eq("id", id)
      .select("*")
      .single();
    if (error || !data) throw error ?? new Error("Could not update conversation");
    return mapConversationRow(data as ConversationRow);
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.supabase.from("conversations").delete().eq("id", id);
    if (error) throw error;
  }
}
