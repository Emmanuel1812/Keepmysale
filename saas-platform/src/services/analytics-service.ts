import type { SupabaseClient } from "@supabase/supabase-js";
import { ConversationsDal } from "@/dal/conversations";
import { NegotiationsDal } from "@/dal/negotiations";
import { OrdersDal } from "@/dal/orders";
import { MessagesDal } from "@/dal/messages";

export interface IAnalyticsSummary {
  // Row 1: KeepMySale Impact
  moneySaved: number;
  returnsPrevented: number;
  partialRefunds: number;
  successRate: number;

  // Row 2: Orders
  totalOrders: number;
  totalRevenue: number;
  avgOrderValue: number;
  fulfilledOrders: number;

  // Row 3: Support
  openConversations: number;
  resolvedToday: number;
  activeNegotiations: number;
  aiHandled: number;
  avgResponseTime: number; // in minutes
}

export class AnalyticsService {
  private readonly conversationsDal: ConversationsDal;
  private readonly negotiationsDal: NegotiationsDal;
  private readonly ordersDal: OrdersDal;
  private readonly messagesDal: MessagesDal;

  constructor(private readonly supabase: SupabaseClient) {
    this.conversationsDal = new ConversationsDal(supabase);
    this.negotiationsDal = new NegotiationsDal(supabase);
    this.ordersDal = new OrdersDal(supabase);
    this.messagesDal = new MessagesDal(supabase);
  }

  async getSummary(merchantId: string): Promise<IAnalyticsSummary> {
    const conversations = await this.conversationsDal.findByMerchant(merchantId);
    const negotiations = await this.negotiationsDal.findByMerchant(merchantId);
    const messages = await this.messagesDal.findByMerchant(merchantId);

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

    // IMPACT METRICS (Row 1)
    const completedNegotiations = negotiations.filter((item) => item.status === "completed");
    const returnsPrevented = completedNegotiations.length;
    const moneySaved = completedNegotiations.reduce((sum, n) => sum + (n.savings || 0), 0);
    const partialRefunds = completedNegotiations.filter((n) => 
      n.finalRefundType === "partial_refund" || n.finalRefundType === "store_credit"
    ).length;
    const totalNegotiations = negotiations.length;
    const successRate = totalNegotiations > 0 ? (returnsPrevented / totalNegotiations) * 100 : 0;

    // ORDERS METRICS (Row 2)
    const orders = await this.ordersDal.findByMerchant(merchantId);
    const totalOrders = orders.length;
    const totalRevenue = orders.reduce((sum, o) => sum + (Number(o.totalPrice) || 0), 0);
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    const fulfilledOrders = orders.filter((o) => o.fulfillmentStatus !== null).length;

    // AI METRICS (Row 3)
    const messagesByConv = new Map<string, typeof messages>();
    for (const m of messages) {
      if (!messagesByConv.has(m.conversationId)) messagesByConv.set(m.conversationId, []);
      messagesByConv.get(m.conversationId)!.push(m);
    }

    let aiHandled = 0;
    let totalResponseTimeMs = 0;
    let responseCount = 0;

    for (const [, convMsgs] of messagesByConv.entries()) {
      const sorted = convMsgs.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      
      const hasHuman = sorted.some(m => m.sender === "human_agent");
      if (!hasHuman && sorted.length > 0) {
        aiHandled++;
      }

      let lastInboundTime: number | null = null;
      for (const m of sorted) {
        const time = new Date(m.createdAt).getTime();
        if (m.sender === "customer") {
          lastInboundTime = time;
        } else if (lastInboundTime !== null && (m.sender === "ai" || m.sender === "human_agent")) {
          // Answer to customer
          totalResponseTimeMs += (time - lastInboundTime);
          responseCount++;
          lastInboundTime = null; // Wait for the next customer message
        }
      }
    }

    const avgResponseTime = responseCount > 0 ? (totalResponseTimeMs / responseCount) / 1000 / 60 : 0; // in minutes

    return {
      moneySaved,
      returnsPrevented,
      partialRefunds,
      successRate,
      totalOrders,
      totalRevenue,
      avgOrderValue,
      fulfilledOrders,
      openConversations,
      resolvedToday,
      activeNegotiations,
      aiHandled,
      avgResponseTime,
    };
  }
}
