import type { SupabaseClient } from "@supabase/supabase-js";
import type { IConversation, IConversationCreate, IConversationUpdate } from "@/types";
import { ConversationsDal } from "@/dal/conversations";

export class ConversationService {
  private readonly conversationsDal: ConversationsDal;

  constructor(private readonly supabase: SupabaseClient) {
    this.conversationsDal = new ConversationsDal(supabase);
  }

  findById(id: string): Promise<IConversation | null> {
    return this.conversationsDal.findById(id);
  }

  findByMerchant(merchantId: string): Promise<IConversation[]> {
    return this.conversationsDal.findByMerchant(merchantId);
  }

  create(input: IConversationCreate): Promise<IConversation> {
    return this.conversationsDal.create(input);
  }

  findOrCreate(input: IConversationCreate): Promise<IConversation> {
    return this.conversationsDal.findOrCreate(input);
  }

  update(id: string, input: IConversationUpdate): Promise<IConversation> {
    return this.conversationsDal.update(id, input);
  }

  delete(id: string): Promise<void> {
    return this.conversationsDal.delete(id);
  }
}
