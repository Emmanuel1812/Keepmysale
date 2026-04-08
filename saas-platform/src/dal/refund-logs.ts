import type { SupabaseClient } from "@supabase/supabase-js";
import type { IRefundLog, IRefundLogCreate, IRefundLogUpdate } from "@/types/refund";

type RefundLogRow = Record<string, unknown>;

function mapRefundLogRow(row: RefundLogRow): IRefundLog {
  return {
    id: String(row.id),
    merchantId: String(row.merchant_id),
    negotiationId: (row.negotiation_id as string | null) ?? null,
    orderId: (row.order_id as string | null) ?? null,
    customerId: (row.customer_id as string | null) ?? null,
    action: String(row.action),
    amount: row.amount === null || row.amount === undefined ? null : String(row.amount),
    currency: String(row.currency ?? "EUR"),
    shopifyRefundId: (row.shopify_refund_id as string | null) ?? null,
    shopifyTransactionId: (row.shopify_transaction_id as string | null) ?? null,
    channel: (row.channel as IRefundLog["channel"]) ?? null,
    customerConsentRecorded: Boolean(row.customer_consent_recorded),
    auditDetails: ((row.audit_details as Record<string, unknown> | null) ?? {}) as Record<
      string,
      unknown
    >,
    createdAt: String(row.created_at),
  };
}

export class RefundLogsDal {
  constructor(private readonly supabase: SupabaseClient) {}

  async findById(id: string): Promise<IRefundLog | null> {
    const { data, error } = await this.supabase.from("refund_logs").select("*").eq("id", id).single();
    if (error || !data) return null;
    return mapRefundLogRow(data as RefundLogRow);
  }

  async findByMerchant(merchantId: string): Promise<IRefundLog[]> {
    const { data, error } = await this.supabase
      .from("refund_logs")
      .select("*")
      .eq("merchant_id", merchantId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((row) => mapRefundLogRow(row as RefundLogRow));
  }

  async create(input: IRefundLogCreate): Promise<IRefundLog> {
    const { data, error } = await this.supabase
      .from("refund_logs")
      .insert({
        merchant_id: input.merchantId,
        negotiation_id: input.negotiationId ?? null,
        order_id: input.orderId ?? null,
        customer_id: input.customerId ?? null,
        action: input.action,
        amount: input.amount ?? null,
        currency: input.currency ?? "EUR",
        shopify_refund_id: input.shopifyRefundId ?? null,
        shopify_transaction_id: input.shopifyTransactionId ?? null,
        channel: input.channel ?? null,
        customer_consent_recorded: input.customerConsentRecorded ?? false,
        audit_details: input.auditDetails ?? {},
      })
      .select("*")
      .single();
    if (error || !data) throw error ?? new Error("Could not create refund log");
    return mapRefundLogRow(data as RefundLogRow);
  }

  async update(id: string, input: IRefundLogUpdate): Promise<IRefundLog> {
    const { data, error } = await this.supabase
      .from("refund_logs")
      .update({
        action: input.action,
        amount: input.amount,
        currency: input.currency,
        customer_consent_recorded: input.customerConsentRecorded,
        audit_details: input.auditDetails,
      })
      .eq("id", id)
      .select("*")
      .single();
    if (error || !data) throw error ?? new Error("Could not update refund log");
    return mapRefundLogRow(data as RefundLogRow);
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.supabase.from("refund_logs").delete().eq("id", id);
    if (error) throw error;
  }
}
