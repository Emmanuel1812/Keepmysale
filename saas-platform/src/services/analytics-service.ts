import type { SupabaseClient } from "@supabase/supabase-js";
import { ConversationsDal } from "@/dal/conversations";
import { NegotiationsDal } from "@/dal/negotiations";

export interface IAnalyticsSummary {
  openConversations: number;
  resolvedToday: number;
  activeNegotiations: number;
  returnsPrevented: number;
}

export class AnalyticsService {
  private readonly conversationsDal: ConversationsDal;
  private readonly negotiationsDal: NegotiationsDal;

  constructor(private readonly supabase: SupabaseClient) {
    this.conversationsDal = new ConversationsDal(supabase);
    this.negotiationsDal = new NegotiationsDal(supabase);
  }

  async getSummary(merchantId: string): Promise<IAnalyticsSummary> {
    const conversations = await this.conversationsDal.findByMerchant(merchantId);
    const negotiations = await this.negotiationsDal.findByMerchant(merchantId);
    const openConversations = conversations.filter((item) => item.status === "open").length;
    const today = new Date().toISOString().slice(0, 10);
    const resolvedToday = conversations.filter(
      (item) => item.status === "resolved" && item.updatedAt.slice(0, 10) === today,
    ).length;
    const activeNegotiations = negotiations.filter((item) =>
      ["initiated", "offer_sent", "offer_rejected"].includes(item.status),
    ).length;
    const returnsPrevented = negotiations.filter((item) =>
      item.status === "completed" &&
      (item.finalRefundType === "partial_refund" ||
        item.finalRefundType === "store_credit" ||
        item.finalRefundType === "exchange"),
    ).length;

    return {
      openConversations,
      resolvedToday,
      activeNegotiations,
      returnsPrevented,
    };
  }
}
