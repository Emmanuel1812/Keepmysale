import type { SupabaseClient } from "@supabase/supabase-js";
import type { IMessage, IMessageCreate, IMessageUpdate } from "@/types";
import { MessagesDal } from "@/dal/messages";

export class MessageService {
  private readonly messagesDal: MessagesDal;

  constructor(private readonly supabase: SupabaseClient) {
    this.messagesDal = new MessagesDal(supabase);
  }

  findById(id: string): Promise<IMessage | null> {
    return this.messagesDal.findById(id);
  }

  findByMerchant(merchantId: string): Promise<IMessage[]> {
    return this.messagesDal.findByMerchant(merchantId);
  }

  findByConversation(conversationId: string): Promise<IMessage[]> {
    return this.messagesDal.findByConversation(conversationId);
  }

  findByExternalMessageId(merchantId: string, externalMessageId: string): Promise<IMessage | null> {
    return this.messagesDal.findByExternalMessageId(merchantId, externalMessageId);
  }

  create(input: IMessageCreate): Promise<IMessage> {
    return this.messagesDal.create(input);
  }

  update(id: string, input: IMessageUpdate): Promise<IMessage> {
    return this.messagesDal.update(id, input);
  }

  delete(id: string): Promise<void> {
    return this.messagesDal.delete(id);
  }
}
