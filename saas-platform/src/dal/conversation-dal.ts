import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { ConversationsDal } from "@/dal/conversations";

export { ConversationsDal };

export async function listConversationsByMerchant(merchantId: string) {
  const dal = new ConversationsDal(createSupabaseServiceClient());
  return dal.findByMerchant(merchantId);
}
