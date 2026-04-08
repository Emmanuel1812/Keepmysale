import type { SupabaseClient } from "@supabase/supabase-js";
import type { IOrder, IOrderCreate, IOrderUpdate } from "@/types";
import { OrdersDal } from "@/dal/orders";
import { fetchOrderByName } from "@/lib/shopify/client";

export class OrderService {
  private readonly ordersDal: OrdersDal;

  constructor(private readonly supabase: SupabaseClient) {
    this.ordersDal = new OrdersDal(supabase);
  }

  findById(id: string): Promise<IOrder | null> {
    return this.ordersDal.findById(id);
  }

  findByMerchant(merchantId: string): Promise<IOrder[]> {
    return this.ordersDal.findByMerchant(merchantId);
  }

  create(input: IOrderCreate): Promise<IOrder> {
    return this.ordersDal.create(input);
  }

  update(id: string, input: IOrderUpdate): Promise<IOrder> {
    return this.ordersDal.update(id, input);
  }

  delete(id: string): Promise<void> {
    return this.ordersDal.delete(id);
  }

  fetchShopifyOrderByName(shopDomain: string, accessToken: string, orderName: string) {
    return fetchOrderByName({ shopDomain, accessToken, orderName });
  }

  async upsertFromShopify(
    merchantId: string,
    shopifyOrderData: Record<string, unknown>,
    customerId?: string | null,
  ): Promise<IOrder> {
    const shopifyOrderId = String(shopifyOrderData.id ?? "");
    if (!shopifyOrderId) {
      throw new Error("Missing Shopify order id");
    }

    const existing = await this.ordersDal.findByShopifyOrderId(merchantId, shopifyOrderId);

    const payload: IOrderUpdate = {
      shopifyOrderNumber: (shopifyOrderData.name as string | undefined) ?? null,
      customerId: customerId ?? null,
      email: (shopifyOrderData.email as string | undefined) ?? null,
      financialStatus: (shopifyOrderData.financial_status as string | undefined) ?? null,
      fulfillmentStatus: (shopifyOrderData.fulfillment_status as string | undefined) ?? null,
      totalPrice:
        shopifyOrderData.total_price === undefined || shopifyOrderData.total_price === null
          ? null
          : Number(shopifyOrderData.total_price),
      currency: (shopifyOrderData.currency as string | undefined) ?? "EUR",
      lineItems: (shopifyOrderData.line_items as Array<Record<string, unknown>> | undefined) ?? [],
    };

    const fulfillments = shopifyOrderData.fulfillments as Array<Record<string, unknown>> | undefined;
    if (fulfillments && fulfillments.length > 0) {
      const latest = fulfillments[fulfillments.length - 1];
      payload.trackingNumber = (latest.tracking_number as string) ?? null;
      payload.trackingUrl = (latest.tracking_url as string) ?? null;
      payload.trackingCompany = (latest.tracking_company as string) ?? null;
      
      if (latest.shipment_status === "delivered") {
        payload.deliveredAt = new Date().toISOString();
      }
    }

    if (existing) {
      return this.ordersDal.update(existing.id, payload);
    }

    return this.ordersDal.create({
      merchantId,
      shopifyOrderId,
      ...payload,
    });
  }

  updateTracking(
    orderId: string,
    trackingData: {
      trackingNumber?: string | null;
      trackingUrl?: string | null;
      trackingCompany?: string | null;
      deliveredAt?: string | null;
      proactiveCheckSent?: boolean;
      fulfillmentStatus?: string | null;
    },
  ): Promise<IOrder> {
    return this.ordersDal.update(orderId, {
      trackingNumber: trackingData.trackingNumber ?? null,
      trackingUrl: trackingData.trackingUrl ?? null,
      trackingCompany: trackingData.trackingCompany ?? null,
      deliveredAt: trackingData.deliveredAt ?? null,
      proactiveCheckSent: trackingData.proactiveCheckSent,
      fulfillmentStatus: trackingData.fulfillmentStatus ?? null,
    });
  }
}
