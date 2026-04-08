"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FulfillmentBadge, FinancialBadge } from "@/components/ui/status-badges";

interface Summary {
  openConversations: number;
  resolvedToday: number;
  activeNegotiations: number;
  returnsPrevented: number;
  totalOrders: number;
  totalRevenue: number;
  avgOrderValue: number;
  fulfilledOrders: number;
  shopName?: string;
}

interface OrderItem {
  id: string;
  shopifyOrderNumber: string | null;
  totalPrice: string | null;
  currency: string;
  financialStatus: string | null;
  fulfillmentStatus: string | null;
  trackingNumber: string | null;
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<Summary>({
    openConversations: 0,
    resolvedToday: 0,
    activeNegotiations: 0,
    returnsPrevented: 0,
    totalOrders: 0,
    totalRevenue: 0,
    avgOrderValue: 0,
    fulfilledOrders: 0,
  });
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  async function loadOrders() {
    const response = await fetch("/api/orders", { cache: "no-store" });
    const payload = (await response.json()) as { success: boolean; data?: { orders: OrderItem[] } };
    if (payload.success) {
      setOrders(payload.data?.orders ?? []);
    }
  }

  async function syncOrders() {
    if (syncing) return;
    setSyncing(true);
    setSyncError(null);
    try {
      const response = await fetch("/api/shopify/sync-orders", { method: "POST" });
      const payload = (await response.json()) as {
        success: boolean;
        error?: { code?: string; message?: string; details?: { reconnectUrl?: string } };
      };
      if (!response.ok || !payload.success) {
        if (payload.error?.details?.reconnectUrl) {
          window.location.href = payload.error.details.reconnectUrl;
          return;
        }
        setSyncError(payload.error?.message ?? "Sync failed. Please try again.");
        return;
      }
      await loadOrders();
    } finally {
      setSyncing(false);
    }
  }

  useEffect(() => {
    async function loadSummary() {
      const response = await fetch("/api/analytics/summary", { cache: "no-store" });
      const payload = (await response.json()) as { success: boolean; data?: Summary };
      if (payload.success && payload.data) {
        setSummary(payload.data);
      }
    }
    void loadSummary();
    void loadOrders();
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">
          {summary.shopName ? `Welcome, ${summary.shopName}!` : "Dashboard Overview"}
        </h1>
        <Button onClick={() => void syncOrders()} disabled={syncing}>
          {syncing ? "Syncing..." : "Sync Orders"}
        </Button>
      </div>
      {syncError ? <p className="text-sm text-red-600">{syncError}</p> : null}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="flex flex-col gap-1 p-4">
          <span className="text-sm font-medium text-zinc-500">Total orders</span>
          <span className="text-2xl font-bold">{summary.totalOrders}</span>
        </Card>
        <Card className="flex flex-col gap-1 p-4">
          <span className="text-sm font-medium text-zinc-500">Total revenue</span>
          <span className="text-2xl font-bold">${summary.totalRevenue.toFixed(2)}</span>
        </Card>
        <Card className="flex flex-col gap-1 p-4">
          <span className="text-sm font-medium text-zinc-500">Avg order value</span>
          <span className="text-2xl font-bold">${summary.avgOrderValue.toFixed(2)}</span>
        </Card>
        <Card className="flex flex-col gap-1 p-4">
          <span className="text-sm font-medium text-zinc-500">Fulfilled orders</span>
          <span className="text-2xl font-bold">{summary.fulfilledOrders}</span>
        </Card>
        <Card className="flex flex-col gap-1 p-4">
          <span className="text-sm font-medium text-zinc-500">Open conversations</span>
          <span className="text-2xl font-bold">{summary.openConversations}</span>
        </Card>
        <Card className="flex flex-col gap-1 p-4">
          <span className="text-sm font-medium text-zinc-500">Resolved today</span>
          <span className="text-2xl font-bold">{summary.resolvedToday}</span>
        </Card>
        <Card className="flex flex-col gap-1 p-4">
          <span className="text-sm font-medium text-zinc-500">Active negotiations</span>
          <span className="text-2xl font-bold">{summary.activeNegotiations}</span>
        </Card>
        <Card className="flex flex-col gap-1 p-4">
          <span className="text-sm font-medium text-zinc-500">Returns prevented</span>
          <span className="text-2xl font-bold">{summary.returnsPrevented}</span>
        </Card>
      </div>
      <Card className="p-4">
        <h2 className="mb-3 text-base font-semibold">Recent Orders</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left">
              <tr>
                <th className="p-2">Order</th>
                <th className="p-2">Amount</th>
                <th className="p-2">Payment</th>
                <th className="p-2">Fulfillment</th>
                <th className="p-2">Tracking</th>
              </tr>
            </thead>
            <tbody>
              {orders.slice(0, 8).map((order) => (
                <tr key={order.id} className="border-t">
                  <td className="p-2">{order.shopifyOrderNumber ?? order.id}</td>
                  <td className="p-2">
                    {order.totalPrice ?? "0.00"} {order.currency}
                  </td>
                  <td className="p-2">
                    <FinancialBadge status={order.financialStatus} />
                  </td>
                  <td className="p-2">
                    <FulfillmentBadge status={order.fulfillmentStatus} />
                  </td>
                  <td className="p-2">{order.trackingNumber ?? "-"}</td>
                </tr>
              ))}
              {orders.length === 0 ? (
                <tr>
                  <td className="p-2 text-zinc-500" colSpan={5}>
                    No orders synced yet. Click Sync Orders.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
