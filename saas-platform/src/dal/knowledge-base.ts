import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  IKnowledgeBaseCreate,
  IKnowledgeBaseItem,
  IKnowledgeBaseUpdate,
} from "@/types/knowledge-base";

type KnowledgeBaseRow = Record<string, unknown>;

function mapKnowledgeBaseRow(row: KnowledgeBaseRow): IKnowledgeBaseItem {
  return {
    id: String(row.id),
    merchantId: String(row.merchant_id),
    title: String(row.title),
    content: String(row.content),
    contentEmbedding: (row.content_embedding as number[] | null) ?? null,
    category: (row.category as string | null) ?? null,
    language: String(row.language ?? "nl"),
    active: Boolean(row.active),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export class KnowledgeBaseDal {
  constructor(private readonly supabase: SupabaseClient) {}

  async findById(id: string): Promise<IKnowledgeBaseItem | null> {
    const { data, error } = await this.supabase.from("knowledge_base").select("*").eq("id", id).single();
    if (error || !data) return null;
    return mapKnowledgeBaseRow(data as KnowledgeBaseRow);
  }

  async findByMerchant(merchantId: string): Promise<IKnowledgeBaseItem[]> {
    const { data, error } = await this.supabase
      .from("knowledge_base")
      .select("*")
      .eq("merchant_id", merchantId)
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((row) => mapKnowledgeBaseRow(row as KnowledgeBaseRow));
  }

  async create(input: IKnowledgeBaseCreate): Promise<IKnowledgeBaseItem> {
    const { data, error } = await this.supabase
      .from("knowledge_base")
      .insert({
        merchant_id: input.merchantId,
        title: input.title,
        content: input.content,
        content_embedding: input.contentEmbedding ?? null,
        category: input.category ?? null,
        language: input.language ?? "nl",
        active: input.active ?? true,
      })
      .select("*")
      .single();
    if (error || !data) throw error ?? new Error("Could not create knowledge base item");
    return mapKnowledgeBaseRow(data as KnowledgeBaseRow);
  }

  async update(id: string, input: IKnowledgeBaseUpdate): Promise<IKnowledgeBaseItem> {
    const { data, error } = await this.supabase
      .from("knowledge_base")
      .update({
        title: input.title,
        content: input.content,
        content_embedding: input.contentEmbedding,
        category: input.category,
        language: input.language,
        active: input.active,
      })
      .eq("id", id)
      .select("*")
      .single();
    if (error || !data) throw error ?? new Error("Could not update knowledge base item");
    return mapKnowledgeBaseRow(data as KnowledgeBaseRow);
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.supabase.from("knowledge_base").delete().eq("id", id);
    if (error) throw error;
  }
}
