import type { SupabaseClient } from "@supabase/supabase-js";
import { ConversationsDal } from "@/dal/conversations";
import { NegotiationsDal } from "@/dal/negotiations";
import { OrdersDal } from "@/dal/orders";

export interface IAnalyticsSummary {
  openConversations: number;
  resolvedToday: number;
  activeNegotiations: number;
  returnsPrevented: number;
  totalOrders: number;
  totalRevenue: number;
  avgOrderValue: number;
  fulfilledOrders: number;
}

export class AnalyticsService {
  private readonly conversationsDal: ConversationsDal;
  private readonly negotiationsDal: NegotiationsDal;
  private readonly ordersDal: OrdersDal;

  constructor(private readonly supabase: SupabaseClient) {
    this.conversationsDal = new ConversationsDal(supabase);
    this.negotiationsDal = new NegotiationsDal(supabase);
    this.ordersDal = new OrdersDal(supabase);
  }

  async getSummary(merchantId: string): Promise<IAnalyticsSummary> {
    const conversations = await this.conversationsDal.findByMerchant(merchantId);
    const negotiations = await this.negotiationsDal.findByMerchant(merchantId);
    const openConversations = conversations.filter((item) => item.status === "open").length;
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const resolvedToday = conversations.filter((item) => {
      if (item.status !== "resolved" || !item.resolvedAt) return false;
      return item.resolvedAt.slice(0, 10) === todayStr;
    }).length;
    const activeNegotiations = negotiations.filter((item) =>
      ["initiated", "offer_sent", "offer_rejected"].includes(item.status),
    ).length;
    const returnsPrevented = negotiations.filter((item) =>
      item.status === "completed" &&
      (item.finalRefundType === "partial_refund" ||
        item.finalRefundType === "store_credit" ||
        item.finalRefundType === "exchange"),
    ).length;

    const orders = await this.ordersDal.findByMerchant(merchantId);
    const totalOrders = orders.length;
    const totalRevenue = orders.reduce((sum, o) => sum + (Number(o.totalPrice) || 0), 0);
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    const fulfilledOrders = orders.filter((o) => o.fulfillmentStatus !== null).length;

    return {
      openConversations,
      resolvedToday,
      activeNegotiations,
      returnsPrevented,
      totalOrders,
      totalRevenue,
      avgOrderValue,
      fulfilledOrders,
    };
  }
}
