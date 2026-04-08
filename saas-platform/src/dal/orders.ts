import type { SupabaseClient } from "@supabase/supabase-js";
import type { IOrder, IOrderCreate, IOrderUpdate } from "@/types/order";

type OrderRow = Record<string, unknown>;

function mapOrderRow(row: OrderRow): IOrder {
  return {
    id: String(row.id),
    merchantId: String(row.merchant_id),
    shopifyOrderId: String(row.shopify_order_id),
    shopifyOrderNumber: (row.shopify_order_number as string | null) ?? null,
    customerId: (row.customer_id as string | null) ?? null,
    email: (row.email as string | null) ?? null,
    financialStatus: (row.financial_status as string | null) ?? null,
    fulfillmentStatus: (row.fulfillment_status as string | null) ?? null,
    totalPrice: row.total_price === null || row.total_price === undefined ? null : String(row.total_price),
    currency: String(row.currency ?? "EUR"),
    trackingNumber: (row.tracking_number as string | null) ?? null,
    trackingUrl: (row.tracking_url as string | null) ?? null,
    trackingCompany: (row.tracking_company as string | null) ?? null,
    deliveredAt: (row.delivered_at as string | null) ?? null,
    proactiveCheckSent: Boolean(row.proactive_check_sent),
    syncedAt: String(row.synced_at),
    lineItems: ((row.line_items as Array<Record<string, unknown>> | null) ?? []) as Array<
      Record<string, unknown>
    >,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export class OrdersDal {
  constructor(private readonly supabase: SupabaseClient) {}

  async findById(id: string): Promise<IOrder | null> {
    const { data, error } = await this.supabase.from("orders").select("*").eq("id", id).single();
    if (error || !data) return null;
    return mapOrderRow(data as OrderRow);
  }

  async findByMerchant(merchantId: string): Promise<IOrder[]> {
    const { data, error } = await this.supabase
      .from("orders")
      .select("*")
      .eq("merchant_id", merchantId)
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((row) => mapOrderRow(row as OrderRow));
  }

  async create(input: IOrderCreate): Promise<IOrder> {
    const { data, error } = await this.supabase
      .from("orders")
      .insert({
        merchant_id: input.merchantId,
        shopify_order_id: input.shopifyOrderId,
        shopify_order_number: input.shopifyOrderNumber ?? null,
        customer_id: input.customerId ?? null,
        email: input.email ?? null,
        financial_status: input.financialStatus ?? null,
        fulfillment_status: input.fulfillmentStatus ?? null,
        total_price: input.totalPrice ?? null,
        currency: input.currency ?? "EUR",
        line_items: input.lineItems ?? [],
        tracking_number: input.trackingNumber ?? null,
        tracking_url: input.trackingUrl ?? null,
        tracking_company: input.trackingCompany ?? null,
        delivered_at: input.deliveredAt ?? null,
      })
      .select("*")
      .single();
    if (error || !data) throw error ?? new Error("Could not create order");
    return mapOrderRow(data as OrderRow);
  }

  async update(id: string, input: IOrderUpdate): Promise<IOrder> {
    const { data, error } = await this.supabase
      .from("orders")
      .update({
        shopify_order_number: input.shopifyOrderNumber,
        customer_id: input.customerId,
        email: input.email,
        financial_status: input.financialStatus,
        fulfillment_status: input.fulfillmentStatus,
        total_price: input.totalPrice,
        currency: input.currency,
        line_items: input.lineItems,
        tracking_number: input.trackingNumber,
        tracking_url: input.trackingUrl,
        tracking_company: input.trackingCompany,
        delivered_at: input.deliveredAt,
        proactive_check_sent: input.proactiveCheckSent,
      })
      .eq("id", id)
      .select("*")
      .single();
    if (error || !data) throw error ?? new Error("Could not update order");
    return mapOrderRow(data as OrderRow);
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.supabase.from("orders").delete().eq("id", id);
    if (error) throw error;
  }
}
