import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  INegotiation,
  INegotiationCreate,
  INegotiationOffer,
  INegotiationUpdate,
  TNegotiationStatus,
} from "@/types/negotiation";

type NegotiationRow = Record<string, unknown>;

function mapNegotiationRow(row: NegotiationRow): INegotiation {
  return {
    id: String(row.id),
    merchantId: String(row.merchant_id),
    conversationId: String(row.conversation_id),
    customerId: String(row.customer_id),
    orderId: (row.order_id as string | null) ?? null,
    status: row.status as INegotiation["status"],
    currentStep: Number(row.current_step ?? 0),
    maxSteps: Number(row.max_steps ?? 3),
    offers: ((row.offers as INegotiation["offers"] | null) ?? []) as INegotiation["offers"],
    productCost: (row.product_cost as number | null) ?? null,
    estimatedReturnCost: (row.estimated_return_cost as number | null) ?? null,
    finalRefundAmount: (row.final_refund_amount as number | null) ?? null,
    finalRefundType: (row.final_refund_type as INegotiation["finalRefundType"]) ?? null,
    savings: row.savings ? Number(row.savings) : null,
    shopifyRefundId: (row.shopify_refund_id as string | null) ?? null,
    refundProcessed: Boolean(row.refund_processed),
    refundProcessedAt: (row.refund_processed_at as string | null) ?? null,
    returnStatus: (row.return_status as string) ?? "awaiting_processing",
    completedAt: (row.completed_at as string | null) ?? null,
    returnReason: (row.return_reason as string | null) ?? null,
    customerFeedback: (row.customer_feedback as string | null) ?? null,
    auditPdfUrl: (row.audit_pdf_url as string | null) ?? null,
    isManualRefundRequired: Boolean(row.is_manual_refund_required ?? false),
    refundRejectionReason: (row.refund_rejection_reason as string | null) ?? null,
    generatedDiscountCode: (row.generated_discount_code as string | null) ?? null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export class NegotiationsDal {
  constructor(private readonly supabase: SupabaseClient) {}

  async findById(id: string): Promise<INegotiation | null> {
    const { data, error } = await this.supabase.from("negotiations").select("*").eq("id", id).single();
    if (error || !data) return null;
    return mapNegotiationRow(data as NegotiationRow);
  }

  async findByMerchant(merchantId: string): Promise<INegotiation[]> {
    const { data, error } = await this.supabase
      .from("negotiations")
      .select("*")
      .eq("merchant_id", merchantId)
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((row) => mapNegotiationRow(row as NegotiationRow));
  }

  async findByConversation(conversationId: string): Promise<INegotiation[]> {
    const { data, error } = await this.supabase
      .from("negotiations")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((row) => mapNegotiationRow(row as NegotiationRow));
  }

  async findActiveByOrder(orderId: string): Promise<INegotiation[]> {
    const { data, error } = await this.supabase
      .from("negotiations")
      .select("*")
      .eq("order_id", orderId)
      .in("status", ["initiated", "offer_sent", "offer_rejected"])
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((row) => mapNegotiationRow(row as NegotiationRow));
  }

  async findActiveByCustomer(merchantId: string, customerId: string): Promise<INegotiation[]> {
    const { data, error } = await this.supabase
      .from("negotiations")
      .select("*")
      .eq("merchant_id", merchantId)
      .eq("customer_id", customerId)
      .in("status", ["initiated", "offer_sent", "offer_rejected"])
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((row) => mapNegotiationRow(row as NegotiationRow));
  }

  async create(input: INegotiationCreate): Promise<INegotiation> {
    const { data, error } = await this.supabase
      .from("negotiations")
      .insert({
        merchant_id: input.merchantId,
        conversation_id: input.conversationId,
        customer_id: input.customerId,
        order_id: input.orderId ?? null,
        status: input.status ?? "initiated",
        current_step: input.currentStep ?? 0,
        max_steps: input.maxSteps ?? 3,
        offers: input.offers ?? [],
        product_cost: input.productCost ?? null,
        estimated_return_cost: input.estimatedReturnCost ?? null,
        final_refund_amount: input.finalRefundAmount ?? null,
        final_refund_type: input.finalRefundType ?? null,
        savings: input.savings ?? null,
        shopify_refund_id: input.shopifyRefundId ?? null,
        refund_processed: input.refundProcessed ?? false,
        refund_processed_at: input.refundProcessedAt ?? null,
        return_status: input.returnStatus ?? "awaiting_processing",
        completed_at: input.completedAt ?? null,
        return_reason: input.returnReason ?? null,
        customer_feedback: input.customerFeedback ?? null,
        is_manual_refund_required: input.isManualRefundRequired ?? false,
        refund_rejection_reason: input.refundRejectionReason ?? null,
        generated_discount_code: input.generatedDiscountCode ?? null,
      })
      .select("*")
      .single();
    if (error || !data) throw error ?? new Error("Could not create negotiation");
    return mapNegotiationRow(data as NegotiationRow);
  }

  async update(id: string, input: INegotiationUpdate): Promise<INegotiation> {
    const { data, error } = await this.supabase
      .from("negotiations")
      .update({
        status: input.status,
        current_step: input.currentStep,
        max_steps: input.maxSteps,
        offers: input.offers,
        product_cost: input.productCost,
        estimated_return_cost: input.estimatedReturnCost,
        final_refund_amount: input.finalRefundAmount,
        final_refund_type: input.finalRefundType,
        shopify_refund_id: input.shopifyRefundId,
        return_reason: input.returnReason,
        customer_feedback: input.customerFeedback,
        savings: input.savings,
        audit_pdf_url: input.auditPdfUrl,
        completed_at: input.completedAt,
        is_manual_refund_required: input.isManualRefundRequired,
        refund_rejection_reason: input.refundRejectionReason,
        generated_discount_code: input.generatedDiscountCode,
        refund_processed: input.refundProcessed,
        refund_processed_at: input.refundProcessedAt,
        return_status: input.returnStatus,
      })
      .eq("id", id)
      .select("*")
      .single();
    if (error || !data) throw error ?? new Error("Could not update negotiation");
    return mapNegotiationRow(data as NegotiationRow);
  }

  async updateStatus(id: string, status: TNegotiationStatus): Promise<INegotiation> {
    return this.update(id, { status });
  }

  async addOffer(id: string, offer: INegotiationOffer): Promise<INegotiation> {
    const { data, error } = await this.supabase.rpc("append_negotiation_offer", {
      p_negotiation_id: id,
      p_offer: offer,
    });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) {
      throw new Error("Could not append negotiation offer");
    }
    return mapNegotiationRow(row as NegotiationRow);
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.supabase.from("negotiations").delete().eq("id", id);
    if (error) throw error;
  }
}
