import type { SupabaseClient } from "@supabase/supabase-js";
import type { IKnowledgeBaseCreate, IKnowledgeBaseItem, IKnowledgeBaseUpdate } from "@/types";
import { KnowledgeBaseDal } from "@/dal/knowledge-base";

export class KnowledgeBaseService {
  private readonly knowledgeBaseDal: KnowledgeBaseDal;

  constructor(private readonly supabase: SupabaseClient) {
    this.knowledgeBaseDal = new KnowledgeBaseDal(supabase);
  }

  findById(id: string): Promise<IKnowledgeBaseItem | null> {
    return this.knowledgeBaseDal.findById(id);
  }

  findByMerchant(merchantId: string): Promise<IKnowledgeBaseItem[]> {
    return this.knowledgeBaseDal.findByMerchant(merchantId);
  }

  create(input: IKnowledgeBaseCreate): Promise<IKnowledgeBaseItem> {
    return this.knowledgeBaseDal.create(input);
  }

  update(id: string, input: IKnowledgeBaseUpdate): Promise<IKnowledgeBaseItem> {
    return this.knowledgeBaseDal.update(id, input);
  }

  delete(id: string): Promise<void> {
    return this.knowledgeBaseDal.delete(id);
  }
}
