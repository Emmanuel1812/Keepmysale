"use client";

import { useEffect, useState } from "react";

interface OrderItem {
  id: string;
  shopifyOrderNumber: string | null;
  email: string | null;
  totalPrice: string | null;
  currency: string;
  fulfillmentStatus: string | null;
  trackingNumber: string | null;
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadOrders() {
      const response = await fetch("/api/orders", { cache: "no-store" });
      const payload = (await response.json()) as { success: boolean; data?: { orders: OrderItem[] } };
      if (payload.success) {
        setOrders(payload.data?.orders ?? []);
      }
      setLoading(false);
    }
    void loadOrders();
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
      <h1 className="text-2xl font-semibold">Orders</h1>
      {loading ? (
        <div className="rounded-lg border p-4 text-sm">Loading orders...</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="min-w-full text-sm">
            <thead className="bg-zinc-50 text-left dark:bg-zinc-900">
              <tr>
                <th className="p-3">Order</th>
                <th className="p-3">Customer</th>
                <th className="p-3">Amount</th>
                <th className="p-3">Fulfillment</th>
                <th className="p-3">Tracking</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="border-t">
                  <td className="p-3">{order.shopifyOrderNumber ?? order.id}</td>
                  <td className="p-3">{order.email ?? "-"}</td>
                  <td className="p-3">
                    {order.totalPrice ?? "0.00"} {order.currency}
                  </td>
                  <td className="p-3">{order.fulfillmentStatus ?? "-"}</td>
                  <td className="p-3">{order.trackingNumber ?? "-"}</td>
                </tr>
              ))}
              {orders.length === 0 ? (
                <tr>
                  <td className="p-3 text-zinc-500" colSpan={5}>
                    No orders synced yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
