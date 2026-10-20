"use client";

import { dominantCurrency, formatMoney } from "@/lib/money";
import { orderLabel } from "@/lib/order-label";
import { useEffect, useState } from "react";
import { FulfillmentBadge, FinancialBadge } from "@/components/ui/status-badges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState, PageHeader, Skeleton } from "@/components/ui/page";
import { AlertIcon, BoxIcon, CheckIcon, CloseIcon, SearchIcon, SyncIcon } from "@/components/ui/icons";

interface LineItem {
  id: string;
  name: string;
  title: string;
  quantity: number;
  sku: string | null;
  price: string;
}

interface OrderItem {
  id: string;
  shopifyOrderId: string;
  shopifyOrderNumber: string | null;
  email: string | null;
  customerName: string | null;
  totalPrice: string | null;
  currency: string;
  financialStatus: string | null;
  fulfillmentStatus: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  paymentGateway: string | null;
  lineItems: LineItem[];
  createdAt: string;
}

type Notice = { type: "success" | "error"; message: string } | null;

const money = (amount: string | number | null | undefined, currency: string) =>
  amount === null || amount === undefined || amount === "" ? "–" : formatMoney(Number(amount), currency);

export default function OrdersPage() {
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<Notice>(null);
  const [query, setQuery] = useState("");
  const [shopDomain, setShopDomain] = useState<string | null>(null);

  // Side Panel State
  const [selectedOrder, setSelectedOrder] = useState<OrderItem | null>(null);

  // Refund State
  const [refundAmount, setRefundAmount] = useState("");
  const [refunding, setRefunding] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [refundNotice, setRefundNotice] = useState<Notice>(null);

  async function loadOrders() {
    try {
      setLoading(true);
      const response = await fetch("/api/orders", { cache: "no-store" });
      const payload = (await response.json()) as { success: boolean; data?: { orders: OrderItem[] } };
      if (payload.success) {
        setOrders(payload.data?.orders ?? []);
      }
    } catch (err) {
      console.error("Failed to fetch orders", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadOrders();
    // The shop's own domain, for "open in Shopify" links
    fetch("/api/merchant/profile", { cache: "no-store" })
      .then((r) => r.json())
      .then((p) => setShopDomain(p?.data?.merchant?.shopDomain ?? null))
      .catch(() => {});
  }, []);

  // Escape closes the order panel
  useEffect(() => {
    if (!selectedOrder) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && closePanel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedOrder]);

  async function handleSync() {
    if (syncing) return;
    setSyncing(true);
    setSyncStatus(null);

    try {
      await fetch("/api/shopify/sync-orders", { method: "POST" });
      await fetch("/api/automation/sync-emails", { method: "POST" });
      setSyncStatus({ type: "success", message: "Orders and emails are up to date." });
      await loadOrders();
    } catch {
      setSyncStatus({ type: "error", message: "Sync failed. Check your connection and try again." });
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncStatus(null), 5000);
    }
  }

  async function handleRefund() {
    if (!selectedOrder || !refundAmount || refunding) return;

    // First click asks, second click refunds (no browser confirm dialog)
    if (!confirming) {
      setConfirming(true);
      return;
    }

    setRefunding(true);
    setRefundNotice(null);
    try {
      const res = await fetch("/api/shopify/order/refund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: selectedOrder.shopifyOrderId,
          amount: refundAmount,
          currency: selectedOrder.currency,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setRefundNotice({ type: "success", message: "Refund sent. It can take a few minutes to show in Shopify." });
        setRefundAmount("");
        await loadOrders();
      } else {
        setRefundNotice({ type: "error", message: `Refund failed: ${data.error?.message || "unknown error"}` });
      }
    } catch {
      setRefundNotice({ type: "error", message: "The refund could not be sent. Nothing was charged; try again." });
    } finally {
      setRefunding(false);
      setConfirming(false);
    }
  }

  const openPanel = (order: OrderItem) => {
    setSelectedOrder(order);
    setRefundAmount("");
    setConfirming(false);
    setRefundNotice(null);
  };

  const closePanel = () => {
    setSelectedOrder(null);
  };

  const shopifyOrderUrl = (order: OrderItem) => {
    const rawId = order.shopifyOrderId?.split("/").pop();
    return shopDomain && rawId ? `https://${shopDomain}/admin/orders/${rawId}` : null;
  };

  const currency = dominantCurrency(orders.map((o) => o.currency));
  const totalRevenue = orders.reduce((acc, order) => acc + Number(order.totalPrice || 0), 0);
  const q = query.trim().toLowerCase();
  const visible = q
    ? orders.filter((o) =>
        [o.shopifyOrderNumber, o.customerName, o.email, o.trackingNumber].some((v) => (v ?? "").toLowerCase().includes(q)),
      )
    : orders;

  return (
    <div className="relative w-full">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-7 pb-12">
        <PageHeader
          title="Orders"
          description="Every order KeepMySale can see, with payment, delivery and tracking."
          actions={
            <Button onClick={handleSync} loading={syncing}>
              {syncing ? null : <SyncIcon className="h-4 w-4" />}
              {syncing ? "Syncing" : "Sync orders"}
            </Button>
          }
        />

        {syncStatus && (
          <p role="status" className={`kms-enter -mt-3 flex items-center gap-2 text-sm ${syncStatus.type === "success" ? "text-kept-strong" : "text-lost"}`}>
            {syncStatus.type === "success" ? <CheckIcon className="h-4 w-4" /> : <AlertIcon className="h-4 w-4" />}
            {syncStatus.message}
          </p>
        )}

        <section className="kms-card kms-enter grid grid-cols-2 gap-x-6 gap-y-5 p-5 lg:grid-cols-4" style={{ ["--i" as string]: 1 }}>
          <Stat label="Orders" value={loading ? null : String(orders.length)} />
          <Stat label="Revenue" value={loading ? null : formatMoney(totalRevenue, currency)} />
          <Stat label="Fulfilled" value={loading ? null : String(orders.filter((o) => o.fulfillmentStatus === "fulfilled").length)} tone="kept" />
          <Stat label="Not yet shipped" value={loading ? null : String(orders.filter((o) => !o.fulfillmentStatus || o.fulfillmentStatus === "unfulfilled").length)} tone="attention" />
        </section>

        <section className="kms-card kms-enter overflow-hidden" style={{ ["--i" as string]: 2 }}>
          <div className="flex items-center gap-3 border-b border-line px-5 py-3">
            <label className="relative w-full max-w-xs">
              <span className="sr-only">Search orders</span>
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Order, customer or tracking" className="h-9 pl-9" />
            </label>
            {q ? <span className="text-sm text-muted tabular">{visible.length} of {orders.length}</span> : null}
          </div>

          {loading ? (
            <div className="flex flex-col gap-3 p-5">
              {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : orders.length === 0 ? (
            <EmptyState
              icon={<BoxIcon className="h-5 w-5" />}
              title="No orders yet"
              body="Sync your Shopify store and your orders appear here, with tracking and refunds one click away."
              action={<Button onClick={handleSync} loading={syncing}>{syncing ? "Syncing" : "Sync orders"}</Button>}
            />
          ) : visible.length === 0 ? (
            <EmptyState icon={<SearchIcon className="h-5 w-5" />} title="No matching orders" body={`Nothing matches "${query}". Try an order number, a name or an email address.`} />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-surface-2 text-left text-xs font-semibold text-muted">
                  <tr>
                    <th className="px-5 py-2.5">Order</th>
                    <th className="px-5 py-2.5">Customer</th>
                    <th className="px-5 py-2.5 text-right">Amount</th>
                    <th className="px-5 py-2.5">Status</th>
                    <th className="px-5 py-2.5">Tracking</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {visible.map((order) => (
                    <tr
                      key={order.id}
                      onClick={() => openPanel(order)}
                      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), openPanel(order))}
                      tabIndex={0}
                      aria-label={`Open order ${orderLabel(order.shopifyOrderNumber, order.id)}`}
                      className={`kms-row group cursor-pointer focus-visible:bg-kept-soft/60 ${selectedOrder?.id === order.id ? "bg-kept-soft/60" : ""}`}
                    >
                      <td className="px-5 py-3.5">
                        <span className="block font-semibold text-foreground group-hover:text-kept-strong">{orderLabel(order.shopifyOrderNumber, order.id)}</span>
                        <span className="text-xs text-faint">{new Date(order.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}</span>
                      </td>
                      <td className="max-w-[16rem] px-5 py-3.5">
                        <span className="block truncate font-medium text-foreground">{order.customerName || <span className="text-faint">No name</span>}</span>
                        <span className="block truncate text-xs text-faint">{order.email}</span>
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5 text-right font-semibold text-foreground">{money(order.totalPrice, order.currency)}</td>
                      <td className="px-5 py-3.5">
                        <div className="flex flex-wrap gap-1.5">
                          <FinancialBadge status={order.financialStatus} />
                          <FulfillmentBadge status={order.fulfillmentStatus} />
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-muted">
                        {order.trackingNumber ? <span className="tabular text-[13px]">{order.trackingNumber}</span> : <span className="text-faint">–</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {/* --- SIDE PANEL (ORDER DETAILS) --- */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={`Order ${orderLabel(selectedOrder.shopifyOrderNumber, selectedOrder.id)}`}>
          <button aria-label="Close" className="absolute inset-0 bg-ink/40 backdrop-blur-[2px] [animation:kms-fade-in_200ms_ease_both]" onClick={closePanel} />

          <div className="absolute right-0 top-0 flex h-full w-full max-w-lg flex-col overflow-y-auto bg-background shadow-raised [animation:kms-panel-in_300ms_var(--ease-out)_both] motion-reduce:[animation:kms-fade-in_150ms_ease_both]">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-white/95 px-6 py-4 backdrop-blur">
              <div>
                <h2 className="text-lg font-semibold tracking-[-0.01em] text-foreground">Order {orderLabel(selectedOrder.shopifyOrderNumber, selectedOrder.id)}</h2>
                <p className="text-xs text-muted">Placed {new Date(selectedOrder.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</p>
              </div>
              <button onClick={closePanel} aria-label="Close order" className="kms-press grid h-9 w-9 place-items-center rounded-[10px] text-muted hover:bg-surface-2 hover:text-foreground">
                <CloseIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="flex flex-col gap-5 p-6">
              <section className="kms-card p-5">
                <h3 className="kms-section-title mb-3">Customer</h3>
                <dl className="flex flex-col gap-2.5 text-sm">
                  <Row label="Name"><span className="font-medium">{selectedOrder.customerName || "Unknown"}</span></Row>
                  <Row label="Email">
                    {selectedOrder.email ? <a href={`mailto:${selectedOrder.email}`} className="font-medium text-kept-strong hover:underline">{selectedOrder.email}</a> : "–"}
                  </Row>
                  <Row label="Paid with"><Badge variant="outline">{selectedOrder.paymentGateway?.replace(/_/g, " ") || "Unknown"}</Badge></Row>
                  <Row label="Status">
                    <span className="flex gap-1.5"><FinancialBadge status={selectedOrder.financialStatus} /><FulfillmentBadge status={selectedOrder.fulfillmentStatus} /></span>
                  </Row>
                </dl>
              </section>

              <section className="kms-card overflow-hidden">
                <h3 className="kms-section-title px-5 pb-2 pt-5">Items</h3>
                <table className="w-full text-sm">
                  <thead className="text-left text-xs font-semibold text-muted">
                    <tr>
                      <th className="px-5 py-2">Product</th>
                      <th className="px-5 py-2 text-center">Qty</th>
                      <th className="px-5 py-2 text-right">Price</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {(selectedOrder.lineItems ?? []).map((item, idx) => (
                      <tr key={idx}>
                        <td className="px-5 py-3">
                          <p className="font-medium text-foreground">{item.title}</p>
                          {item.sku ? <p className="text-xs text-faint">SKU {item.sku}</p> : null}
                        </td>
                        <td className="px-5 py-3 text-center tabular">{item.quantity}</td>
                        <td className="px-5 py-3 text-right font-medium">{money(item.price, selectedOrder.currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="flex items-center justify-between border-t border-line bg-surface-2 px-5 py-3.5">
                  <span className="text-sm font-medium text-muted">Total</span>
                  <span className="text-lg font-semibold text-foreground tabular">{money(selectedOrder.totalPrice, selectedOrder.currency)}</span>
                </div>
              </section>

              <section>
                <h3 className="kms-section-title">Partial refund</h3>
                <p className="mt-1 text-[13px] text-muted">Refund part of this order without leaving KeepMySale.</p>

                {selectedOrder.paymentGateway === "shopify_payments" ? (
                  <div className="kms-card mt-3 flex flex-col gap-3 p-5">
                    <label className="flex flex-col gap-1.5">
                      <span className="text-[13px] font-medium text-foreground">Amount ({selectedOrder.currency})</span>
                      <Input
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        className="font-semibold tabular"
                        value={refundAmount}
                        onChange={(e) => { setRefundAmount(e.target.value); setConfirming(false); }}
                      />
                      <span className="text-xs text-muted">Paid with Shopify Payments, so you can refund from here.</span>
                    </label>
                    <Button
                      className={`w-full ${confirming ? "!bg-attention hover:!bg-[#92400e]" : ""}`}
                      disabled={!refundAmount || Number(refundAmount) <= 0}
                      loading={refunding}
                      onClick={handleRefund}
                    >
                      {refunding
                        ? "Refunding"
                        : confirming
                          ? `Confirm: refund ${money(refundAmount, selectedOrder.currency)}`
                          : "Refund"}
                    </Button>
                    {refundNotice ? (
                      <p role="status" className={`kms-enter text-[13px] ${refundNotice.type === "success" ? "text-kept-strong" : "text-lost"}`}>{refundNotice.message}</p>
                    ) : null}
                  </div>
                ) : (
                  <div className="mt-3 rounded-[var(--radius-card)] bg-surface-2 p-5 ring-1 ring-inset ring-line">
                    <p className="text-[13px] text-muted">
                      Paid with <span className="font-semibold text-foreground">{selectedOrder.paymentGateway?.replace(/_/g, " ") || "an external gateway"}</span>, so refunds go through Shopify.
                    </p>
                    {shopifyOrderUrl(selectedOrder) ? (
                      <a
                        href={shopifyOrderUrl(selectedOrder)!}
                        target="_blank"
                        rel="noreferrer"
                        className="kms-press mt-3 inline-flex h-9 items-center rounded-[10px] border border-line-strong bg-white px-4 text-sm font-semibold text-foreground hover:bg-surface-2"
                      >
                        Open in Shopify
                      </a>
                    ) : null}
                  </div>
                )}
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string | null; tone?: "kept" | "attention" }) {
  const color = tone === "kept" ? "text-kept-strong" : tone === "attention" ? "text-attention" : "text-foreground";
  return (
    <div>
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className={`mt-1 text-[1.5rem] font-semibold tracking-[-0.02em] tabular ${color}`}>{value ?? <Skeleton className="h-7 w-16 align-middle" />}</p>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right text-foreground">{children}</dd>
    </div>
  );
}
