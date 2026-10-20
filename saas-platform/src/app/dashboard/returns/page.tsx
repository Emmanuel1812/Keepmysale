"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader, Skeleton, Tabs } from "@/components/ui/page";
import { ArrowRightIcon, ChatIcon, CheckIcon, ReturnIcon } from "@/components/ui/icons";

interface NegotiationOffer {
  step: number;
  type: string;
  percentage?: number;
  amount: number;
  currency: string;
  offered_at: string;
  response: "pending" | "accepted" | "rejected" | "expired";
}

interface EnrichedNegotiation {
  id: string;
  status: string;
  currentStep: number;
  maxSteps: number;
  offers: NegotiationOffer[];
  savings: number | null;
  shopifyRefundId: string | null;
  refundProcessed: boolean;
  refundProcessedAt: string | null;
  returnStatus: string;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  
  orderNumber: string;
  shopifyOrderId: string | null;
  customerName: string;
  customerEmail: string;
  orderValue: string;
  currency: string;
  shopDomain: string;
  
  conversationId: string;
  lineItems: any[];
}

interface KPIs {
  activeCount: number;
  savedRevenue: number;
  /** The store's main currency (from its orders); savings are in it. */
  currency: string;
  refundsIssued: number;
  pendingReturns: number;
}

type TabType = "active" | "accepted" | "returns";

export default function ReturnsPage() {
  const [activeTab, setActiveTab] = useState<TabType>("active");
  const [negotiations, setNegotiations] = useState<EnrichedNegotiation[]>([]);
  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const loadData = async (tab: TabType) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/returns?tab=${tab}`, { cache: "no-store" });
      const payload = await response.json();
      if (payload.success) {
        setNegotiations(payload.data?.negotiations ?? []);
        if (payload.data?.kpis) {
          setKpis(payload.data.kpis);
        }
      }
    } catch (err) {
      console.error("Failed to fetch returns state", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData(activeTab);
  }, [activeTab]);

  const handleProcessRefund = async (id: string) => {
    setProcessingId(id);
    try {
       const res = await fetch(`/api/returns/${id}/process`, {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({ action: "mark_processed" })
       });
       if (res.ok) {
         await loadData(activeTab);
       }
    } catch (err) {
      console.error(err);
    } finally {
      setProcessingId(null);
    }
  };

  const handleUpdateReturnStatus = async (id: string, newStatus: string) => {
    setProcessingId(id);
    try {
       const res = await fetch(`/api/returns/${id}/process`, {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({ action: "update_return_status", status: newStatus })
       });
       if (res.ok) {
         await loadData(activeTab);
       }
    } catch (err) {
      console.error(err);
    } finally {
      setProcessingId(null);
    }
  };

  const formatCurrency = (amount: number | string, currency: string) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || "EUR" }).format(Number(amount));
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getShopifyLink = (domain: string, orderId: string) => {
    const rawId = orderId?.includes('/') ? orderId.split('/').pop() : orderId;
    return `https://${domain}/admin/orders/${rawId}`;
  };

  // --- Render Sub-components ---
  
  const renderActiveTable = () => (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm text-left">
        <thead className="border-b border-line bg-surface-2 text-xs font-semibold text-muted">
          <tr>
            <th className="px-5 py-3.5 whitespace-nowrap">Customer</th>
            <th className="px-5 py-3.5 whitespace-nowrap">Order</th>
            <th className="px-5 py-3.5 whitespace-nowrap">Products</th>
            <th className="px-5 py-3.5 whitespace-nowrap">Current Step</th>
            <th className="px-5 py-3.5 whitespace-nowrap">Status</th>
            <th className="px-5 py-3.5 whitespace-nowrap">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {negotiations.length === 0 ? (
            <tr><td colSpan={6}><EmptyState icon={<ChatIcon className="h-5 w-5" />} title="No negotiations running" body="When a customer asks to return an order, KeepMySale makes your first offer and the conversation shows up here." /></td></tr>
          ) : negotiations.map(n => {
            const latestOffer = n.offers?.[n.offers.length - 1];
            return (
              <tr key={n.id} className="kms-row">
                <td className="px-5 py-4 min-w-[200px]">
                  <div className="font-semibold text-foreground">{n.customerName !== "Unknown" ? n.customerName : "Customer"}</div>
                  <div className="text-xs text-muted">{n.customerEmail}</div>
                </td>
                <td className="px-5 py-4 whitespace-nowrap">
                  {n.shopDomain && n.shopifyOrderId ? (
                     <a href={getShopifyLink(n.shopDomain, n.shopifyOrderId)} target="_blank" rel="noreferrer" className="font-semibold text-kept-strong hover:underline">
                       {n.orderNumber}
                     </a>
                  ) : <span className="font-semibold">{n.orderNumber}</span>}
                </td>
                <td className="px-5 py-4 text-xs text-muted max-w-[200px] truncate">
                   {n.lineItems && n.lineItems.length > 0 
                     ? n.lineItems.map(item => `${item.quantity}x ${item.title || item.name}`).join(", ") 
                     : "No line items mapped"
                   }
                </td>
                <td className="px-5 py-4 whitespace-nowrap text-muted">
                  {n.currentStep > 0 ? `Step ${n.currentStep} of ${n.maxSteps} — ${latestOffer?.percentage || 0}% offered` : "Initiating negotiation"}
                </td>
                <td className="px-5 py-4 whitespace-nowrap">
                  <Badge variant="amber" dot>
                    {n.status === 'initiated' ? 'Started' : n.status.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase())}
                  </Badge>
                </td>
                <td className="px-5 py-4 whitespace-nowrap">
                  <Link href={`/dashboard/inbox/${n.conversationId}`} className="kms-press inline-flex h-8 items-center gap-1.5 rounded-[10px] border border-line-strong bg-white px-3 text-[13px] font-semibold text-foreground hover:bg-surface-2">
                    Open conversation <ArrowRightIcon className="h-3.5 w-3.5" />
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  const renderAcceptedTable = () => (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm text-left">
        <thead className="border-b border-line bg-surface-2 text-xs font-semibold text-muted">
          <tr>
            <th className="px-5 py-3.5 whitespace-nowrap">Customer</th>
            <th className="px-5 py-3.5 whitespace-nowrap">Order</th>
            <th className="px-5 py-3.5 whitespace-nowrap text-right">Accepted Offer</th>
            <th className="px-5 py-3.5 whitespace-nowrap text-right">Refund</th>
            <th className="px-5 py-3.5 whitespace-nowrap">Status</th>
            <th className="px-5 py-3.5 whitespace-nowrap">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {negotiations.length === 0 ? (
            <tr><td colSpan={6}><EmptyState icon={<CheckIcon className="h-5 w-5" />} title="No accepted offers yet" body="Customers who keep their order for a partial refund or store credit appear here, ready for you to refund." /></td></tr>
          ) : negotiations.map(n => {
            const latestOffer = n.offers?.[n.offers.length - 1];
            return (
              <tr key={n.id} className="kms-row">
                <td className="px-5 py-4 min-w-[200px]">
                  <div className="font-semibold text-foreground">{n.customerName !== "Unknown" ? n.customerName : "Customer"}</div>
                  <div className="text-xs text-muted">{n.customerEmail}</div>
                </td>
                <td className="px-5 py-4 whitespace-nowrap">
                  {n.shopDomain && n.shopifyOrderId ? (
                     <a href={getShopifyLink(n.shopDomain, n.shopifyOrderId)} target="_blank" rel="noreferrer" className="font-semibold text-kept-strong hover:underline">
                       {n.orderNumber}
                     </a>
                  ) : <span className="font-semibold">{n.orderNumber}</span>}
                </td>
                <td className="px-5 py-4 whitespace-nowrap text-right text-muted">
                  {latestOffer ? `${latestOffer.percentage}% ${latestOffer.type.replace("_", " ")}` : '-'}
                </td>
                <td className="px-5 py-4 whitespace-nowrap text-right font-semibold text-foreground">
                  {formatCurrency(latestOffer?.amount || 0, n.currency)}
                </td>
                <td className="px-5 py-4 whitespace-nowrap">
                  {n.refundProcessed ? (
                    <Badge variant="teal" dot>Refunded</Badge>
                  ) : (
                    <Badge variant="amber" dot className="kms-ping">Needs refund</Badge>
                  )}
                </td>
                <td className="px-5 py-4 whitespace-nowrap min-w-[300px]">
                  {n.refundProcessed ? (
                    <div className="text-xs text-muted">
                       Processed on {n.refundProcessedAt ? formatDate(n.refundProcessedAt) : 'Unknown'}
                       <br/>
                       {n.shopDomain && n.shopifyOrderId && (
                          <a href={getShopifyLink(n.shopDomain, n.shopifyOrderId)} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 font-medium text-kept-strong hover:underline">View in Shopify <ArrowRightIcon className="h-3.5 w-3.5" /></a>
                       )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                       {n.shopDomain && n.shopifyOrderId && (
                          <a href={getShopifyLink(n.shopDomain, n.shopifyOrderId)} target="_blank" rel="noreferrer" className="kms-press inline-flex h-8 items-center rounded-[10px] border border-line-strong bg-white px-3 text-[13px] font-semibold text-foreground hover:bg-surface-2">
                            Refund in Shopify
                          </a>
                       )}
                       <Button size="sm" onClick={() => handleProcessRefund(n.id)} loading={processingId === n.id}>{processingId === n.id ? "Saving" : <><CheckIcon className="h-3.5 w-3.5" /> Mark refunded</>}</Button>
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  const renderReturnsTable = () => (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm text-left">
        <thead className="border-b border-line bg-surface-2 text-xs font-semibold text-muted">
          <tr>
            <th className="px-5 py-3.5 whitespace-nowrap">Customer</th>
            <th className="px-5 py-3.5 whitespace-nowrap">Order</th>
            <th className="px-5 py-3.5 min-w-[250px]">Rejection Timeline</th>
            <th className="px-5 py-3.5 whitespace-nowrap">Products</th>
            <th className="px-5 py-3.5 whitespace-nowrap">Return Status</th>
            <th className="px-5 py-3.5 whitespace-nowrap">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {negotiations.length === 0 ? (
            <tr><td colSpan={6}><EmptyState icon={<ReturnIcon className="h-5 w-5" />} title="No returns to process" body="If a customer turns down every offer, the return lands here so you can send a label and refund in full." /></td></tr>
          ) : negotiations.map(n => {
            const timelineStr = (n.offers || []).map(o => `${o.percentage}% declined`).join(", ");
            return (
              <tr key={n.id} className="kms-row">
                <td className="px-5 py-4 min-w-[200px]">
                  <div className="font-semibold text-foreground">{n.customerName !== "Unknown" ? n.customerName : "Customer"}</div>
                  <div className="text-xs text-muted">{n.customerEmail}</div>
                </td>
                <td className="px-5 py-4 whitespace-nowrap">
                  {n.shopDomain && n.shopifyOrderId ? (
                     <a href={getShopifyLink(n.shopDomain, n.shopifyOrderId)} target="_blank" rel="noreferrer" className="font-semibold text-kept-strong hover:underline">
                       {n.orderNumber}
                     </a>
                  ) : <span className="font-semibold">{n.orderNumber}</span>}
                </td>
                <td className="px-5 py-4 text-xs text-muted">
                  <div className="max-w-[250px] whitespace-normal">
                    {timelineStr ? timelineStr : 'No offers made (direct return)'}
                  </div>
                </td>
                <td className="px-5 py-4 text-xs text-muted max-w-[200px] truncate">
                   {n.lineItems && n.lineItems.length > 0 
                     ? n.lineItems.map(item => `${item.quantity}x ${item.title || item.name}`).join(", ") 
                     : "No line items mapped"
                   }
                </td>
                <td className="px-5 py-4 whitespace-nowrap">
                   <select 
                     value={n.returnStatus} 
                     onChange={(e) => handleUpdateReturnStatus(n.id, e.target.value)}
                     disabled={processingId === n.id}
                     className="h-8 rounded-[10px] border border-line-strong bg-white px-2 text-[13px] font-medium text-foreground focus:border-kept focus:outline-none"
                   >
                     <option value="awaiting_processing">Awaiting Processing</option>
                     <option value="return_label_sent">Return Label Sent</option>
                     <option value="return_received">Return Received</option>
                     <option value="refunded">Refunded (Completed)</option>
                   </select>
                </td>
                <td className="px-5 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                     <Link href={`/dashboard/inbox/${n.conversationId}`} className="kms-press inline-flex h-8 items-center rounded-[10px] bg-surface-2 px-3 text-[13px] font-semibold text-foreground ring-1 ring-inset ring-line hover:bg-[#eef2f4]">
                       Open conversation
                     </Link>
                     {n.shopDomain && n.shopifyOrderId && (
                        <a href={getShopifyLink(n.shopDomain, n.shopifyOrderId)} target="_blank" rel="noreferrer" className="kms-press inline-flex h-8 items-center rounded-[10px] border border-line-strong bg-white px-3 text-[13px] font-semibold text-foreground hover:bg-surface-2">
                          Refund in Shopify
                        </a>
                     )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  const tabs = [
    { key: "active" as const, label: "Negotiating", count: kpis?.activeCount },
    { key: "accepted" as const, label: "Accepted offers" },
    { key: "returns" as const, label: "Returns to process", count: kpis?.pendingReturns },
  ];

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-7 pb-12">
      <PageHeader
        title="Returns"
        description="Offers in progress, refunds to issue, and full returns to process."
      />

      <section className="kms-card kms-enter grid grid-cols-2 gap-x-6 gap-y-5 p-5 lg:grid-cols-4" style={{ ["--i" as string]: 1 }}>
        <Kpi label="Negotiating" value={kpis ? String(kpis.activeCount) : null} note="Customers deciding on an offer" />
        <Kpi label="Kept" value={kpis ? formatCurrency(kpis.savedRevenue, kpis.currency) : null} note="From accepted offers" tone="kept" />
        <Kpi label="Refunds issued" value={kpis ? String(kpis.refundsIssued) : null} note="Partial refunds paid out" />
        <Kpi label="Returns to process" value={kpis ? String(kpis.pendingReturns) : null} note="Every offer declined" tone={kpis && kpis.pendingReturns > 0 ? "lost" : undefined} />
      </section>

      <section className="kms-card kms-enter overflow-hidden" style={{ ["--i" as string]: 2 }}>
        <div className="px-3 pt-2">
          <Tabs tabs={tabs} active={activeTab} onChange={setActiveTab} />
        </div>

        <div className="relative min-h-[320px]" aria-busy={loading}>
          {loading ? (
            <div className="flex flex-col gap-3 p-5">
              {[0, 1, 2].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : (
            <div key={activeTab} className="kms-enter">
              {activeTab === 'active' && renderActiveTable()}
              {activeTab === 'accepted' && renderAcceptedTable()}
              {activeTab === 'returns' && renderReturnsTable()}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function Kpi({ label, value, note, tone }: { label: string; value: string | null; note: string; tone?: "kept" | "lost" }) {
  const color = tone === "kept" ? "text-kept-strong" : tone === "lost" ? "text-lost" : "text-foreground";
  return (
    <div>
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className={`mt-1 text-[1.5rem] font-semibold tracking-[-0.02em] tabular ${color}`}>{value ?? <Skeleton className="h-7 w-16 align-middle" />}</p>
      <p className="mt-0.5 text-xs text-faint">{note}</p>
    </div>
  );
}
