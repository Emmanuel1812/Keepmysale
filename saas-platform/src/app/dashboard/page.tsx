"use client";

import { useEffect, useRef, useState, Suspense, type ReactNode } from "react";
import { currencySymbol } from "@/lib/money";
import { orderLabel } from "@/lib/order-label";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FulfillmentBadge, FinancialBadge } from "@/components/ui/status-badges";
import { EmptyState, PageHeader, Skeleton } from "@/components/ui/page";
import { AlertIcon, ArrowRightIcon, BoxIcon, ReplayIcon, SyncIcon } from "@/components/ui/icons";

// --- [HOOKS] ---
function useCountUp(endValue: number, duration = 700) {
  const [value, setValue] = useState(0);
  const shown = useRef(0);
  useEffect(() => {
    // Animate from what is on screen to the new value, and stop the previous run: otherwise two
    // loops fight and the number jumps back to 0 each time fresh data arrives.
    const from = shown.current;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      shown.current = endValue;
      setValue(endValue);
      return;
    }
    let startTimestamp: number | null = null;
    let frame = 0;
    const step = (timestamp: number) => {
      if (startTimestamp === null) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      shown.current = from + (endValue - from) * eased;
      setValue(shown.current);
      if (progress < 1) frame = window.requestAnimationFrame(step);
    };
    frame = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(frame);
  }, [endValue, duration]);
  return value;
}

const AnimatedValue = ({ value, ready = true, prefix = "", suffix = "", decimals = 0, skeleton = "h-7 w-16" }: { value: number; ready?: boolean; prefix?: string; suffix?: string; decimals?: number; skeleton?: string }) => {
  const count = useCountUp(ready ? value : 0);
  // Until the numbers have arrived a "0" or a guessed currency looks like real data (and sat next to a full orders table)
  if (!ready) return <Skeleton className={`${skeleton} align-middle`} />;
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
  currency: string;
  activeNegotiations: number;
  aiHandled: number;
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
  customerName?: string | null;
  email?: string | null;
  createdAt?: string;
  syncedAt?: string;
}

function DashboardContent() {
  const searchParams = useSearchParams();
  const shop = searchParams.get("shop");

  const [summary, setSummary] = useState<Summary>({
    moneySaved: 0, returnsPrevented: 0, partialRefunds: 0, successRate: 0,
    totalOrders: 0, totalRevenue: 0, avgOrderValue: 0, fulfilledOrders: 0,
    openConversations: 0, resolvedToday: 0, activeNegotiations: 0, aiHandled: 0, avgResponseTime: 0,
    pendingRefundsCount: 0,
    currency: "EUR",
  });
  const [summaryLoaded, setSummaryLoaded] = useState(false);
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [ordersLoaded, setOrdersLoaded] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncSuccess, setSyncSuccess] = useState<string | null>(null);

  const getAuthHeaders = () => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    return headers;
  };

  async function loadOrders() {
    try {
      const response = await fetch("/api/orders", {
        cache: "no-store",
        headers: getAuthHeaders(),
      });
      const payload = await response.json();
      if (payload.success) setOrders(payload.data?.orders ?? []);
    } catch {
    } finally {
      setOrdersLoaded(true);
    }
  }

  async function syncOrders() {
    if (syncing) return;
    setSyncing(true);
    setSyncError(null);
    setSyncSuccess(null);
    try {
      const response = await fetch("/api/shopify/sync-orders", {
        method: "POST",
        headers: getAuthHeaders(),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        if (payload.error?.details?.reconnectUrl) {
          window.location.href = payload.error.details.reconnectUrl;
          return;
        }
        setSyncError(payload.error?.message ?? "Sync failed. Please try again.");
        return;
      }
      setSyncSuccess("Orders are up to date.");
      await loadOrders();
    } finally {
      setSyncing(false);
    }
  }

  useEffect(() => {
    async function loadSummary() {
      try {
        const response = await fetch("/api/analytics/summary", {
          cache: "no-store",
          headers: getAuthHeaders(),
        });
        const payload = await response.json();
        if (payload.success && payload.data) {
          setSummary(payload.data);
          setSummaryLoaded(true);
        }
      } catch {}
    }
    void loadSummary();
    void loadOrders();
  }, [shop]); // Reload if shop changes

  function formatTime(minutes: number) {
    if (minutes === 0) return "–";
    if (minutes < 1) return "< 1m";
    if (minutes < 60) return `${Math.round(minutes)}m`;
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    return `${h}h ${m}m`;
  }

  const symbol = currencySymbol(summary.currency);
  const keptSomething = summaryLoaded && summary.moneySaved > 0;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-7 pb-12">
      <PageHeader
        title="Overview"
        description={summary.shopName ? `What KeepMySale kept for ${summary.shopName}, and what needs you.` : "What KeepMySale kept for you, and what needs you."}
        actions={
          <>
            {syncSuccess && !syncing ? <span className="kms-enter text-sm text-kept-strong">{syncSuccess}</span> : null}
            <Button variant="outline" size="sm" onClick={() => void syncOrders()} loading={syncing}>
              {syncing ? null : <SyncIcon className="h-4 w-4" />}
              {syncing ? "Syncing" : "Sync orders"}
            </Button>
          </>
        }
      />

      {syncError && (
        <p role="alert" className="kms-enter -mt-3 flex items-center gap-2 text-sm text-lost">
          <AlertIcon className="h-4 w-4" /> {syncError}
        </p>
      )}

      {summary.pendingRefundsCount > 0 && (
        <div className="kms-enter flex flex-col gap-4 rounded-[var(--radius-card)] bg-attention-soft p-4 ring-1 ring-inset ring-[#f7dfb4] sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-white text-attention shadow-card">
              <AlertIcon className="h-[18px] w-[18px]" />
            </span>
            <div>
              <h3 className="text-sm font-semibold text-[#7c2d12]">
                {summary.pendingRefundsCount} {summary.pendingRefundsCount === 1 ? "customer accepted an offer" : "customers accepted an offer"}
              </h3>
              <p className="mt-0.5 text-[13px] text-[#9a3412]">Issue the agreed partial refunds to close these cases.</p>
            </div>
          </div>
          <Link href="/dashboard/returns?filter=Active" className="shrink-0">
            <Button size="sm" className="bg-attention hover:bg-[#92400e]">Review refunds</Button>
          </Link>
        </div>
      )}

      {/* The money kept: the one figure this product exists for */}
      <section
        aria-label="Kept by KeepMySale"
        className="kms-enter relative overflow-hidden rounded-[18px] bg-ink text-white shadow-raised"
        style={{ ["--i" as string]: 1 }}
      >
        <div className="relative grid gap-8 p-6 sm:p-8 lg:grid-cols-[1.25fr_1fr] lg:items-end">
          <div>
            <p className="text-sm font-medium text-slate-300">Kept from returns that did not happen</p>
            <p className="mt-3 text-[2.75rem] font-bold leading-none tracking-[-0.035em] text-white sm:text-[3.25rem] tabular">
              <span className="kms-kept-number" data-landed={keptSomething ? "true" : "false"}>
                <AnimatedValue ready={summaryLoaded} value={summary.moneySaved} prefix={symbol} decimals={2} skeleton="h-12 w-48 !bg-white/10" />
              </span>
            </p>
            {summaryLoaded && !keptSomething ? (
              <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
                <p className="max-w-md text-sm text-slate-300">
                  Nothing kept yet. See what your last 50 customer emails could have saved you.
                </p>
                <Link href="/dashboard/replay" className="shrink-0">
                  <Button size="sm" className="bg-white !text-ink hover:bg-slate-100">
                    <ReplayIcon className="h-4 w-4" /> Run inbox replay
                  </Button>
                </Link>
              </div>
            ) : null}
          </div>

          <dl className="grid grid-cols-3 gap-4 border-t border-white/10 pt-6 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
            <BandStat label="Returns prevented">
              <AnimatedValue ready={summaryLoaded} value={summary.returnsPrevented} skeleton="h-7 w-10 !bg-white/10" />
            </BandStat>
            <BandStat label="Partial refunds">
              <AnimatedValue ready={summaryLoaded} value={summary.partialRefunds} skeleton="h-7 w-10 !bg-white/10" />
            </BandStat>
            <BandStat label="Offers accepted">
              <AnimatedValue ready={summaryLoaded} value={summary.successRate} suffix="%" decimals={0} skeleton="h-7 w-12 !bg-white/10" />
            </BandStat>
          </dl>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <MetricGroup title="Orders" href="/dashboard/orders" linkLabel="All orders" index={2}>
          <Metric label="Orders"><AnimatedValue ready={summaryLoaded} value={summary.totalOrders} /></Metric>
          <Metric label="Revenue"><AnimatedValue ready={summaryLoaded} value={summary.totalRevenue} prefix={symbol} decimals={0} skeleton="h-7 w-20" /></Metric>
          <Metric label="Avg. order"><AnimatedValue ready={summaryLoaded} value={summary.avgOrderValue} prefix={symbol} decimals={0} skeleton="h-7 w-16" /></Metric>
          <Metric label="Fulfilled"><AnimatedValue ready={summaryLoaded} value={summary.fulfilledOrders} /></Metric>
        </MetricGroup>

        <MetricGroup title="Support" href="/dashboard/inbox" linkLabel="Open inbox" index={3}>
          <Metric label="Open" emphasis={summary.openConversations > 0}><AnimatedValue ready={summaryLoaded} value={summary.openConversations} /></Metric>
          <Metric label="Resolved today"><AnimatedValue ready={summaryLoaded} value={summary.resolvedToday} /></Metric>
          <Metric label="Answered by AI"><AnimatedValue ready={summaryLoaded} value={summary.aiHandled} /></Metric>
          <Metric label="Avg. reply">{summaryLoaded ? formatTime(summary.avgResponseTime) : <Skeleton className="h-7 w-12 align-middle" />}</Metric>
        </MetricGroup>
      </div>

      <section className="kms-card kms-enter overflow-hidden" style={{ ["--i" as string]: 4 }}>
        <div className="flex items-center justify-between px-5 py-4">
          <h2 className="kms-section-title">Recent orders</h2>
          <Link href="/dashboard/orders" className="group flex items-center gap-1 text-sm font-medium text-kept-strong hover:text-kept">
            View all <ArrowRightIcon className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
          </Link>
        </div>

        {!ordersLoaded ? (
          <div className="flex flex-col gap-3 px-5 pb-5">
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-9 w-full" />)}
          </div>
        ) : orders.length === 0 ? (
          <EmptyState
            icon={<BoxIcon className="h-5 w-5" />}
            title="No orders yet"
            body="Sync your Shopify orders so KeepMySale can answer order questions and value returns."
            action={<Button onClick={() => void syncOrders()} loading={syncing}>{syncing ? "Syncing" : "Sync orders"}</Button>}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-y border-line bg-surface-2 text-left">
                <tr>
                  {["Date", "Order", "Customer", "Amount", "Payment", "Fulfillment", "Tracking"].map((h) => (
                    <th key={h} className="whitespace-nowrap px-5 py-2.5 text-xs font-semibold text-muted">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {orders.slice(0, 8).map((order) => (
                  <tr key={order.id} className="kms-row">
                    <td className="whitespace-nowrap px-5 py-3.5 text-muted">
                      {order.createdAt ? new Date(order.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "short" }) : "–"}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5 font-semibold text-foreground">
                      {orderLabel(order.shopifyOrderNumber, order.id)}
                    </td>
                    <td className="max-w-[14rem] truncate whitespace-nowrap px-5 py-3.5 text-foreground">
                      {order.customerName || order.email || <span className="text-faint">–</span>}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5 font-medium text-foreground">
                      {currencySymbol(order.currency)}{Number(order.totalPrice ?? 0).toFixed(2)}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5">
                      <FinancialBadge status={order.financialStatus} />
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5">
                      <FulfillmentBadge status={order.fulfillmentStatus} />
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-muted">
                      {order.trackingUrl ? (
                        <a href={order.trackingUrl} target="_blank" rel="noreferrer" className="font-medium text-kept-strong hover:underline">
                          {order.trackingNumber}
                        </a>
                      ) : order.trackingNumber ? (
                        <span>{order.trackingNumber}</span>
                      ) : (
                        <span className="text-faint">–</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function BandStat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium text-slate-400">{label}</dt>
      <dd className="mt-1.5 text-2xl font-semibold tracking-[-0.02em] text-white tabular">{children}</dd>
    </div>
  );
}

function MetricGroup({ title, href, linkLabel, index, children }: { title: string; href: string; linkLabel: string; index: number; children: ReactNode }) {
  return (
    <section className="kms-card kms-enter p-5" style={{ ["--i" as string]: index }}>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="kms-section-title">{title}</h2>
        <Link href={href} className="group flex items-center gap-1 text-[13px] font-medium text-muted hover:text-kept-strong">
          {linkLabel} <ArrowRightIcon className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
        </Link>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-4">{children}</dl>
    </section>
  );
}

function Metric({ label, emphasis = false, children }: { label: string; emphasis?: boolean; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium text-muted">{label}</dt>
      <dd className={`mt-1 text-[1.375rem] font-semibold tracking-[-0.02em] tabular ${emphasis ? "text-kept-strong" : "text-foreground"}`}>{children}</dd>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={null}>
      <DashboardContent />
    </Suspense>
  );
}
