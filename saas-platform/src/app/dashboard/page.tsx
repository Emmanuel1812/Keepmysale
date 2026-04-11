"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FulfillmentBadge, FinancialBadge } from "@/components/ui/status-badges";

// --- [ICONS] ---
const ShieldIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/></svg>);
const BanknoteIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="12" x="2" y="6" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/></svg>);
const RefreshIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>);
const TrendingUpIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>);
const PackageIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>);
const BarChartIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>);
const CheckCircleIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>);
const MessageIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 21 1.9-5.7a8.5 8.5 0 1 1 3.8 3.8z"/></svg>);
const BotIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="14" x="3" y="6" rx="2" ry="2"/><path d="M12 2v4"/><path d="M8 12h.01"/><path d="M16 12h.01"/><path d="M12 16c-2 0-3-1-3-1"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg>);
const ZapIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>);
const EmptyBoxIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-300"><polyline points="21 8 21 21 3 21 3 8"/><rect width="22" height="5" x="1" y="3" rx="1"/><line x1="10" y1="12" x2="14" y2="12"/></svg>);

// --- [HOOKS] ---
function useCountUp(endValue: number, duration = 1200) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let startTimestamp: number | null = null;
    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      const easeProgress = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      setValue(endValue * easeProgress);
      if (progress < 1) window.requestAnimationFrame(step);
    };
    window.requestAnimationFrame(step);
  }, [endValue, duration]);
  return value;
}

const AnimatedValue = ({ value, prefix = "", suffix = "", decimals = 0 }: { value: number; prefix?: string; suffix?: string; decimals?: number }) => {
  const count = useCountUp(value);
  return <>{prefix}{count.toFixed(decimals)}{suffix}</>;
};

interface Summary {
  moneySaved: number;
  returnsPrevented: number;
  partialRefunds: number;
  successRate: number;
  totalOrders: number;
  totalRevenue: number;
  avgOrderValue: number;
  fulfilledOrders: number;
  openConversations: number;
  resolvedToday: number;
  avgResponseTime: number;
  pendingRefundsCount: number;
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
  trackingUrl?: string | null;
  createdAt?: string;
  syncedAt?: string;
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<Summary>({
    moneySaved: 0, returnsPrevented: 0, partialRefunds: 0, successRate: 0,
    totalOrders: 0, totalRevenue: 0, avgOrderValue: 0, fulfilledOrders: 0,
    openConversations: 0, resolvedToday: 0, activeNegotiations: 0, aiHandled: 0, avgResponseTime: 0,
    pendingRefundsCount: 0,
  });
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncSuccess, setSyncSuccess] = useState<string | null>(null);

  async function loadOrders() {
    try {
      const response = await fetch("/api/orders", { cache: "no-store" });
      const payload = await response.json();
      if (payload.success) setOrders(payload.data?.orders ?? []);
    } catch {}
  }

  async function syncOrders() {
    if (syncing) return;
    setSyncing(true);
    setSyncError(null);
    setSyncSuccess(null);
    try {
      const response = await fetch("/api/shopify/sync-orders", { method: "POST" });
      const payload = await response.json();
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
      try {
        const response = await fetch("/api/analytics/summary", { cache: "no-store" });
        const payload = await response.json();
        if (payload.success && payload.data) setSummary(payload.data);
      } catch {}
    }
    void loadSummary();
    void loadOrders();
  }, []);

  function formatTime(minutes: number) {
    if (minutes === 0) return "-";
    if (minutes < 1) return "< 1m";
    if (minutes < 60) return `${Math.round(minutes)}m`;
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    return `${h}h ${m}m`;
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 pb-10 pt-4 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight text-[#111827]">
          Welcome back!
        </h1>
        <div className="flex flex-col sm:flex-row items-end sm:items-center gap-3">
          <Button 
            variant="outline" 
            size="sm" 
            className="rounded-lg shadow-sm font-medium border-zinc-200 text-zinc-700 hover:bg-zinc-50"
            onClick={() => void syncOrders()} 
            disabled={syncing}
          >
            {syncing ? "Syncing..." : "Sync Orders"}
          </Button>
        </div>
      </div>
      
      {syncError && <p className="text-sm text-red-600 -mt-2">{syncError}</p>}
      {summary.pendingRefundsCount > 0 && (
        <div className="relative overflow-hidden rounded-xl border border-amber-100 bg-amber-50 p-4 shadow-sm dark:bg-amber-900/20 dark:border-amber-800/50 animate-in slide-in-from-top-4 duration-500">
           <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex gap-3">
              <div className="bg-amber-100 p-2 rounded-lg text-amber-600 dark:bg-amber-800/50 dark:text-amber-400">
                <ZapIcon />
              </div>
              <div>
                <h3 className="text-sm font-bold text-amber-900 dark:text-amber-100 italic">Action Required: {summary.pendingRefundsCount} {summary.pendingRefundsCount === 1 ? 'Customer' : 'Customers'} Accepted Offers</h3>
                <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">Please review and issue the agreed partial refunds to resolve these cases.</p>
              </div>
            </div>
            <Link href="/dashboard/returns?filter=Active">
              <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white border-none shadow-sm whitespace-nowrap">
                Review & Issue Refunds
              </Button>
            </Link>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-10">
        {/* ROW 1: KeepMySale Impact */}
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 delay-75 fill-mode-both">
          <h2 className="text-sm font-bold uppercase tracking-wider text-teal-800 mb-4 ml-1">KeepMySale Impact</h2>
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
            <Card className="group relative overflow-hidden rounded-xl p-5 border-none shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md bg-gradient-to-br from-emerald-50 to-teal-50">
              <div className="bg-teal-100 p-2.5 rounded-lg text-teal-600 w-fit">
                <BanknoteIcon />
              </div>
              <div className="mt-4">
                <span className="text-3xl font-extrabold tracking-tight text-teal-800">
                  <AnimatedValue value={summary.moneySaved} prefix="€" decimals={2} />
                </span>
                <p className="mt-1 text-sm font-medium text-teal-700/80">Total Saved</p>
              </div>
            </Card>

            <Card className="group relative overflow-hidden rounded-xl p-5 border-none shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md bg-gradient-to-br from-emerald-50 to-teal-50">
              <div className="bg-teal-100 p-2.5 rounded-lg text-teal-600 w-fit">
                <ShieldIcon />
              </div>
              <div className="mt-4">
                <span className="text-3xl font-bold tracking-tight text-teal-800">
                  <AnimatedValue value={summary.returnsPrevented} decimals={0} />
                </span>
                <p className="mt-1 text-sm font-medium text-teal-700/80">Returns Prevented</p>
              </div>
            </Card>

            <Card className="group relative overflow-hidden rounded-xl p-5 border-none shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md bg-gradient-to-br from-emerald-50 to-teal-50">
              <div className="bg-teal-100 p-2.5 rounded-lg text-teal-600 w-fit">
                <RefreshIcon />
              </div>
              <div className="mt-4">
                <span className="text-3xl font-bold tracking-tight text-teal-800">
                  <AnimatedValue value={summary.partialRefunds} decimals={0} />
                </span>
                <p className="mt-1 text-sm font-medium text-teal-700/80">Partial Refunds Issued</p>
              </div>
            </Card>

            <Card className="group relative overflow-hidden rounded-xl p-5 border-none shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md bg-gradient-to-br from-emerald-50 to-teal-50">
              <div className="bg-teal-100 p-2.5 rounded-lg text-teal-600 w-fit">
                <TrendingUpIcon />
              </div>
              <div className="mt-4">
                <span className="text-3xl font-bold tracking-tight text-teal-800">
                  <AnimatedValue value={summary.successRate} suffix="%" decimals={1} />
                </span>
                <p className="mt-1 text-sm font-medium text-teal-700/80">Negotiation Success Rate</p>
              </div>
            </Card>
          </div>
          {summary.moneySaved === 0 && (
            <p className="text-sm text-zinc-500 mt-4 ml-1 italic">Start saving when your first return negotiation completes.</p>
          )}
        </div>

        {/* ROW 2: Orders */}
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 delay-150 fill-mode-both">
          <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-500 mb-4 ml-1">Orders</h2>
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
            <Card className="rounded-xl border-zinc-100 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
              <div className="text-zinc-400 mb-3"><PackageIcon /></div>
              <span className="text-2xl font-bold tracking-tight text-[#111827]">
                <AnimatedValue value={summary.totalOrders} decimals={0} />
              </span>
              <p className="text-sm font-medium text-zinc-500 mt-0.5">Total Orders</p>
            </Card>
            <Card className="rounded-xl border-zinc-100 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
              <div className="text-zinc-400 mb-3"><BanknoteIcon /></div>
              <span className="text-2xl font-bold tracking-tight text-[#111827]">
                <AnimatedValue value={summary.totalRevenue} prefix="€" decimals={2} />
              </span>
              <p className="text-sm font-medium text-zinc-500 mt-0.5">Total Revenue</p>
            </Card>
            <Card className="rounded-xl border-zinc-100 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
              <div className="text-zinc-400 mb-3"><BarChartIcon /></div>
              <span className="text-2xl font-bold tracking-tight text-[#111827]">
                <AnimatedValue value={summary.avgOrderValue} prefix="€" decimals={2} />
              </span>
              <p className="text-sm font-medium text-zinc-500 mt-0.5">Avg Order Value</p>
            </Card>
            <Card className="rounded-xl border-zinc-100 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
              <div className="text-emerald-500 mb-3"><CheckCircleIcon /></div>
              <span className="text-2xl font-bold tracking-tight text-[#111827]">
                <AnimatedValue value={summary.fulfilledOrders} decimals={0} />
              </span>
              <p className="text-sm font-medium text-zinc-500 mt-0.5">Fulfilled</p>
            </Card>
          </div>
        </div>

        {/* ROW 3: Support */}
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 delay-200 fill-mode-both">
          <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-500 mb-4 ml-1">AI & Support</h2>
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
            <Card className="rounded-xl border-zinc-100 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
              <div className="text-zinc-400 mb-3"><MessageIcon /></div>
              <span className="text-2xl font-bold tracking-tight text-[#111827]">
                <AnimatedValue value={summary.openConversations} decimals={0} />
              </span>
              <p className="text-sm font-medium text-zinc-500 mt-0.5">Open Conversations</p>
            </Card>
            <Card className="rounded-xl border-zinc-100 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
              <div className="text-teal-500 mb-3"><CheckCircleIcon /></div>
              <span className="text-2xl font-bold tracking-tight text-[#111827]">
                <AnimatedValue value={summary.resolvedToday} decimals={0} />
              </span>
              <p className="text-sm font-medium text-zinc-500 mt-0.5">Resolved Today</p>
            </Card>
            <Card className="rounded-xl border-zinc-100 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
              <div className="text-indigo-500 mb-3"><BotIcon /></div>
              <span className="text-2xl font-bold tracking-tight text-[#111827]">
                <AnimatedValue value={summary.aiHandled} decimals={0} />
              </span>
              <p className="text-sm font-medium text-zinc-500 mt-0.5">AI Handled</p>
            </Card>
            <Card className="rounded-xl border-zinc-100 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
              <div className="text-amber-500 mb-3"><ZapIcon /></div>
              <span className="text-2xl font-bold tracking-tight text-[#111827]">
                {formatTime(summary.avgResponseTime)}
              </span>
              <p className="text-sm font-medium text-zinc-500 mt-0.5">Avg Response Time</p>
            </Card>
          </div>
        </div>
      </div>

      <div className="mt-4 animate-in fade-in slide-in-from-bottom-2 duration-500 delay-300 fill-mode-both">
        <Card className="overflow-hidden rounded-xl border-zinc-100 bg-white flex flex-col shadow-sm">
          <div className="flex items-center justify-between p-5 border-b border-zinc-100">
            <h2 className="text-base font-bold text-[#111827]">Recent Orders</h2>
            <Link href="/dashboard/orders" className="text-sm font-medium text-teal-600 hover:text-teal-700 transition-colors">
              View All &rarr;
            </Link>
          </div>
          
          {orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center">
              <EmptyBoxIcon />
              <h3 className="mt-4 text-base font-medium text-[#111827]">No orders synced yet</h3>
              <p className="mt-1 text-sm text-zinc-500 mb-6">Connect your Shopify store to sync orders and start tracking metrics.</p>
              <Button onClick={() => void syncOrders()} disabled={syncing} className="bg-teal-600 hover:bg-teal-700 font-medium">
                {syncing ? "Syncing..." : "Sync Orders"}
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-[#f8fafb] text-left">
                  <tr>
                    <th className="px-5 py-3 font-medium text-zinc-500 whitespace-nowrap">Date</th>
                    <th className="px-5 py-3 font-medium text-zinc-500 whitespace-nowrap">Order</th>
                    <th className="px-5 py-3 font-medium text-zinc-500 whitespace-nowrap">Customer</th>
                    <th className="px-5 py-3 font-medium text-zinc-500 whitespace-nowrap">Amount</th>
                    <th className="px-5 py-3 font-medium text-zinc-500 whitespace-nowrap">Payment</th>
                    <th className="px-5 py-3 font-medium text-zinc-500 whitespace-nowrap">Fulfillment</th>
                    <th className="px-5 py-3 font-medium text-zinc-500 whitespace-nowrap">Tracking</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {orders.slice(0, 8).map((order) => (
                    <tr key={order.id} className="hover:bg-zinc-50/50 transition-colors even:bg-[#f8fafb]/50">
                      <td className="px-5 py-4 whitespace-nowrap text-zinc-500">
                        {order.createdAt ? new Date(order.createdAt).toLocaleDateString() : "-"}
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap font-medium text-[#111827]">
                        #{order.shopifyOrderNumber ?? order.id.slice(0,8)}
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap text-[#111827]">
                        Customer
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap text-[#111827] font-medium">
                        {order.totalPrice ?? "0.00"} {order.currency}
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        <FinancialBadge status={order.financialStatus} />
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        <FulfillmentBadge status={order.fulfillmentStatus} />
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap text-zinc-500">
                        {order.trackingUrl ? (
                          <a href={order.trackingUrl} target="_blank" rel="noreferrer" className="text-teal-600 hover:underline hover:text-teal-700">
                            {order.trackingNumber}
                          </a>
                        ) : order.trackingNumber ? (
                          <span>{order.trackingNumber}</span>
                        ) : (
                          <span className="text-zinc-400">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
