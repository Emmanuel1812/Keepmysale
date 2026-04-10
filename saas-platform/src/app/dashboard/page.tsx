"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FulfillmentBadge, FinancialBadge } from "@/components/ui/status-badges";

interface Summary {
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
  avgResponseTime: number;

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
  createdAt?: string;
  syncedAt?: string;
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<Summary>({
    moneySaved: 0,
    returnsPrevented: 0,
    partialRefunds: 0,
    successRate: 0,
    totalOrders: 0,
    totalRevenue: 0,
    avgOrderValue: 0,
    fulfilledOrders: 0,
    openConversations: 0,
    resolvedToday: 0,
    activeNegotiations: 0,
    aiHandled: 0,
    avgResponseTime: 0,
  });
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncSuccess, setSyncSuccess] = useState<string | null>(null);


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
    setSyncSuccess(null);
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
      setSyncSuccess("Orders synced successfully!");
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

  const lastSync = orders.length > 0 && orders[0]?.syncedAt ? new Date(Math.max(...orders.map(o => new Date(o.syncedAt!).getTime()))) : null;
  const lastSyncMinutes = lastSync ? Math.floor((Date.now() - lastSync.getTime()) / 60000) : null;
  const lastSyncText = lastSyncMinutes !== null ? `Last synced: ${lastSyncMinutes}m ago` : "";

  function formatTime(minutes: number) {
    if (minutes < 1) return "< 1m";
    if (minutes < 60) return `${Math.round(minutes)}m`;
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    return `${h}h ${m}m`;
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">
          {summary.shopName ? `Welcome, ${summary.shopName}!` : "Dashboard Overview"}
        </h1>
        <div className="flex flex-col sm:flex-row items-end sm:items-center gap-3">
          {lastSyncText && <span className="text-sm text-zinc-500">{lastSyncText}</span>}
          <Button size="sm" onClick={() => void syncOrders()} disabled={syncing}>
            {syncing ? "Syncing..." : "Sync Orders"}
          </Button>
        </div>
      </div>
      
      {syncError ? <p className="text-sm text-red-600 -mt-4">{syncError}</p> : null}
      {syncSuccess ? <p className="text-sm text-green-600 -mt-4">{syncSuccess}</p> : null}

      <div className="flex flex-col gap-6">
        {/* ROW 1: KeepMySale Impact */}
        <div>
          <h2 className="text-base font-semibold text-green-800 mb-3 ml-1">KeepMySale Impact</h2>
          <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
            <Card className="flex flex-col gap-1 p-4 border-green-200 bg-green-50 shadow-sm border-2">
              <span className="text-sm font-semibold text-green-700">Money Saved</span>
              <span className="text-3xl font-extrabold text-green-800">€{summary.moneySaved.toFixed(2)}</span>
            </Card>
            <Card className="flex flex-col gap-1 p-4 border-green-200 bg-green-50 shadow-sm">
              <span className="text-sm font-medium text-green-700">Returns Prevented</span>
              <span className="text-2xl font-bold text-green-800">{summary.returnsPrevented}</span>
            </Card>
            <Card className="flex flex-col gap-1 p-4 border-green-200 bg-green-50 shadow-sm">
              <span className="text-sm font-medium text-green-700">Partial Refunds</span>
              <span className="text-2xl font-bold text-green-800">{summary.partialRefunds}</span>
            </Card>
            <Card className="flex flex-col gap-1 p-4 border-green-200 bg-green-50 shadow-sm">
              <span className="text-sm font-medium text-green-700">Success Rate</span>
              <span className="text-2xl font-bold text-green-800">{summary.successRate.toFixed(1)}%</span>
            </Card>
          </div>
        </div>

        {/* ROW 2: Orders */}
        <div>
          <h2 className="text-base font-semibold mb-3 ml-1">Orders Summary</h2>
          <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
            <Card className="flex flex-col gap-1 p-4">
              <span className="text-sm font-medium text-zinc-500">Total Orders</span>
              <span className="text-2xl font-bold">{summary.totalOrders}</span>
            </Card>
            <Card className="flex flex-col gap-1 p-4">
              <span className="text-sm font-medium text-zinc-500">Total Revenue</span>
              <span className="text-2xl font-bold">€{summary.totalRevenue.toFixed(2)}</span>
            </Card>
            <Card className="flex flex-col gap-1 p-4">
              <span className="text-sm font-medium text-zinc-500">Avg Order Value</span>
              <span className="text-2xl font-bold">€{summary.avgOrderValue.toFixed(2)}</span>
            </Card>
            <Card className="flex flex-col gap-1 p-4">
              <span className="text-sm font-medium text-zinc-500">Fulfilled</span>
              <span className="text-2xl font-bold">{summary.fulfilledOrders}</span>
            </Card>
          </div>
        </div>

        {/* ROW 3: Support */}
        <div>
          <h2 className="text-base font-semibold mb-3 ml-1">AI & Support</h2>
          <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
            <Card className="flex flex-col gap-1 p-4">
              <span className="text-sm font-medium text-zinc-500">Open Conversations</span>
              <span className="text-2xl font-bold">{summary.openConversations}</span>
            </Card>
            <Card className="flex flex-col gap-1 p-4">
              <span className="text-sm font-medium text-zinc-500">Resolved Today</span>
              <span className="text-2xl font-bold">{summary.resolvedToday}</span>
            </Card>
            <Card className="flex flex-col gap-1 p-4">
              <span className="text-sm font-medium text-zinc-500">AI Handled</span>
              <span className="text-2xl font-bold">{summary.aiHandled}</span>
            </Card>
            <Card className="flex flex-col gap-1 p-4">
              <span className="text-sm font-medium text-zinc-500">Avg Response Time</span>
              <span className="text-2xl font-bold">{formatTime(summary.avgResponseTime)}</span>
            </Card>
          </div>
        </div>
      </div>

      <Card className="p-4 overflow-hidden flex flex-col">
        <h2 className="mb-3 text-base font-semibold">Recent Orders</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left border-b pb-2">
              <tr>
                <th className="p-2 whitespace-nowrap font-medium text-zinc-600">Date</th>
                <th className="p-2 whitespace-nowrap font-medium text-zinc-600">Order</th>
                <th className="p-2 whitespace-nowrap font-medium text-zinc-600">Amount</th>
                <th className="p-2 whitespace-nowrap font-medium text-zinc-600">Payment</th>
                <th className="p-2 whitespace-nowrap font-medium text-zinc-600">Fulfillment</th>
                <th className="p-2 whitespace-nowrap font-medium text-zinc-600">Tracking</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {orders.slice(0, 8).map((order) => (
                <tr key={order.id} className="hover:bg-zinc-50/50 transition-colors">
                  <td className="p-2 whitespace-nowrap text-zinc-500">
                    {order.createdAt ? new Date(order.createdAt).toLocaleDateString() : "-"}
                  </td>
                  <td className="p-2 whitespace-nowrap font-medium">#{order.shopifyOrderNumber ?? order.id.slice(0,8)}</td>
                  <td className="p-2 whitespace-nowrap">
                    {order.totalPrice ?? "0.00"} {order.currency}
                  </td>
                  <td className="p-2 whitespace-nowrap">
                    <FinancialBadge status={order.financialStatus} />
                  </td>
                  <td className="p-2 whitespace-nowrap">
                    <FulfillmentBadge status={order.fulfillmentStatus} />
                  </td>
                  <td className="p-2 whitespace-nowrap text-zinc-500">{order.trackingNumber ?? "-"}</td>
                </tr>
              ))}
              {orders.length === 0 ? (
                <tr>
                  <td className="p-4 text-center text-zinc-500" colSpan={6}>
                    No orders synced yet. Click Sync Orders to fetch from Shopify.
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
