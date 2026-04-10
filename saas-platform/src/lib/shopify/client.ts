import type { IShopifyOrderSummary } from "@/types/shopify";

export async function fetchOrderByName(params: {
  shopDomain: string;
  accessToken: string;
  orderName: string;
}): Promise<IShopifyOrderSummary | null> {
  const url = `https://${params.shopDomain}/admin/api/2025-01/orders.json?status=any&name=${encodeURIComponent(params.orderName)}`;
  const response = await fetch(url, {
    headers: {
      "X-Shopify-Access-Token": params.accessToken,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Shopify order fetch failed with ${response.status}`);
  }

  const data = (await response.json()) as { orders: Array<Record<string, unknown>> };
  const order = data.orders[0];
  if (!order) return null;

  return {
    id: String(order.id),
    name: String(order.name),
    email: (order.email as string | null) ?? null,
    fulfillmentStatus: (order.fulfillment_status as string | null) ?? null,
    trackingNumber:
      ((order.fulfillments as Array<{ tracking_number?: string }> | undefined)?.[0]?.tracking_number ??
        null),
    totalPrice: String(order.total_price ?? ""),
    currency: String(order.currency ?? "EUR"),
    lineItems: (order.line_items as Array<any>) ?? [],
  };
}

export async function createRefund(params: {
  shopDomain: string;
  accessToken: string;
  orderId: string;
  amount: number;
  currency: string;
}): Promise<{ refundId: string; transactionId: string | null }> {
  const numericOrderId = params.orderId.includes("/")
    ? params.orderId.split("/").pop() ?? params.orderId
    : params.orderId;
  const url = `https://${params.shopDomain}/admin/api/2025-01/orders/${numericOrderId}/refunds.json`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "X-Shopify-Access-Token": params.accessToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      refund: {
        currency: params.currency,
        note: "Automated refund from ReturnShield",
        transactions: [
          {
            kind: "refund",
            amount: params.amount.toFixed(2),
            currency: params.currency,
          },
        ],
      },
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Shopify refund failed with ${response.status}`);
  }

  const data = (await response.json()) as {
    refund?: { id?: string | number; transactions?: Array<{ id?: string | number }> };
  };
  const refundId = data.refund?.id;
  if (!refundId) {
    throw new Error("Shopify refund response missing id");
  }

  return {
    refundId: String(refundId),
    transactionId: data.refund?.transactions?.[0]?.id ? String(data.refund.transactions[0].id) : null,
  };
}
