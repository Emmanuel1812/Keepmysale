"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

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
        <thead className="bg-zinc-50 text-[11px] font-semibold tracking-wider text-zinc-500 uppercase">
          <tr>
            <th className="px-5 py-3.5 whitespace-nowrap">Customer</th>
            <th className="px-5 py-3.5 whitespace-nowrap">Order</th>
            <th className="px-5 py-3.5 whitespace-nowrap">Products</th>
            <th className="px-5 py-3.5 whitespace-nowrap">Current Step</th>
            <th className="px-5 py-3.5 whitespace-nowrap">Status</th>
            <th className="px-5 py-3.5 whitespace-nowrap">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200 bg-white">
          {negotiations.length === 0 ? (
            <tr><td colSpan={6} className="px-5 py-8 text-center text-zinc-500 italic">No active negotiations found.</td></tr>
          ) : negotiations.map(n => {
            const latestOffer = n.offers?.[n.offers.length - 1];
            return (
              <tr key={n.id} className="hover:bg-zinc-50/50 transition-colors">
                <td className="px-5 py-4 min-w-[200px]">
                  <div className="font-semibold text-zinc-900">{n.customerName !== "Unknown" ? n.customerName : "Customer"}</div>
                  <div className="text-xs text-zinc-500">{n.customerEmail}</div>
                </td>
                <td className="px-5 py-4 whitespace-nowrap">
                  {n.shopDomain && n.shopifyOrderId ? (
                     <a href={getShopifyLink(n.shopDomain, n.shopifyOrderId)} target="_blank" className="text-teal-600 hover:text-teal-700 font-semibold underline">
                       {n.orderNumber}
                     </a>
                  ) : <span className="font-semibold">{n.orderNumber}</span>}
                </td>
                <td className="px-5 py-4 text-xs text-zinc-600 max-w-[200px] truncate">
                   {n.lineItems && n.lineItems.length > 0 
                     ? n.lineItems.map(item => `${item.quantity}x ${item.title || item.name}`).join(", ") 
                     : "No line items mapped"
                   }
                </td>
                <td className="px-5 py-4 whitespace-nowrap text-zinc-600">
                  {n.currentStep > 0 ? `Step ${n.currentStep} of ${n.maxSteps} — ${latestOffer?.percentage || 0}% offered` : "Initiating negotiation"}
                </td>
                <td className="px-5 py-4 whitespace-nowrap">
                  <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                    {n.status === 'initiated' ? 'Started' : n.status.replace("_", " ")}
                  </span>
                </td>
                <td className="px-5 py-4 whitespace-nowrap">
                  <Link href={`/dashboard/inbox/${n.conversationId}`} className="text-sm font-semibold rounded-md border border-zinc-200 px-3 py-1.5 hover:bg-zinc-100 transition-colors">
                    View Conversation
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
        <thead className="bg-zinc-50 text-[11px] font-semibold tracking-wider text-zinc-500 uppercase">
          <tr>
            <th className="px-5 py-3.5 whitespace-nowrap">Customer</th>
            <th className="px-5 py-3.5 whitespace-nowrap">Order</th>
            <th className="px-5 py-3.5 whitespace-nowrap text-right">Accepted Offer</th>
            <th className="px-5 py-3.5 whitespace-nowrap text-right text-emerald-600">Refund Amount</th>
            <th className="px-5 py-3.5 whitespace-nowrap">Status</th>
            <th className="px-5 py-3.5 whitespace-nowrap">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200 bg-white">
          {negotiations.length === 0 ? (
            <tr><td colSpan={6} className="px-5 py-8 text-center text-zinc-500 italic">No accepted negotiations found.</td></tr>
          ) : negotiations.map(n => {
            const latestOffer = n.offers?.[n.offers.length - 1];
            return (
              <tr key={n.id} className="hover:bg-zinc-50/50 transition-colors">
                <td className="px-5 py-4 min-w-[200px]">
                  <div className="font-semibold text-zinc-900">{n.customerName !== "Unknown" ? n.customerName : "Customer"}</div>
                  <div className="text-xs text-zinc-500">{n.customerEmail}</div>
                </td>
                <td className="px-5 py-4 whitespace-nowrap">
                  {n.shopDomain && n.shopifyOrderId ? (
                     <a href={getShopifyLink(n.shopDomain, n.shopifyOrderId)} target="_blank" className="text-teal-600 hover:text-teal-700 font-semibold underline">
                       {n.orderNumber}
                     </a>
                  ) : <span className="font-semibold">{n.orderNumber}</span>}
                </td>
                <td className="px-5 py-4 whitespace-nowrap text-right text-zinc-600">
                  {latestOffer ? `${latestOffer.percentage}% ${latestOffer.type.replace("_", " ")}` : '-'}
                </td>
                <td className="px-5 py-4 whitespace-nowrap text-right font-bold text-emerald-700">
                  {formatCurrency(latestOffer?.amount || 0, n.currency)}
                </td>
                <td className="px-5 py-4 whitespace-nowrap">
                  {n.refundProcessed ? (
                    <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-600/20">
                      Processed ✅
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-amber-600/20 animate-pulse">
                      Pending Action ⚡
                    </span>
                  )}
                </td>
                <td className="px-5 py-4 whitespace-nowrap min-w-[300px]">
                  {n.refundProcessed ? (
                    <div className="text-xs text-zinc-500">
                       Processed on {n.refundProcessedAt ? formatDate(n.refundProcessedAt) : 'Unknown'}
                       <br/>
                       {n.shopDomain && n.shopifyOrderId && (
                          <a href={getShopifyLink(n.shopDomain, n.shopifyOrderId)} target="_blank" className="text-teal-600 hover:text-teal-700 underline mt-1 block">View in Shopify &rarr;</a>
                       )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                       {n.shopDomain && n.shopifyOrderId && (
                          <a href={getShopifyLink(n.shopDomain, n.shopifyOrderId)} target="_blank" className="text-xs font-semibold rounded-md border border-zinc-300 bg-white text-zinc-700 px-3 py-1.5 hover:bg-zinc-50 transition-colors">
                            Process in Shopify ↗
                          </a>
                       )}
                       <button 
                         onClick={() => handleProcessRefund(n.id)}
                         disabled={processingId === n.id}
                         className="text-xs font-bold rounded-md bg-emerald-600 text-white px-3 py-1.5 hover:bg-emerald-700 transition-colors disabled:opacity-50 inline-flex items-center gap-1 shadow-sm"
                       >
                         {processingId === n.id ? "Updating..." : "Mark as Processed"}
                       </button>
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
        <thead className="bg-zinc-50 text-[11px] font-semibold tracking-wider text-zinc-500 uppercase">
          <tr>
            <th className="px-5 py-3.5 whitespace-nowrap">Customer</th>
            <th className="px-5 py-3.5 whitespace-nowrap">Order</th>
            <th className="px-5 py-3.5 min-w-[250px]">Rejection Timeline</th>
            <th className="px-5 py-3.5 whitespace-nowrap">Products</th>
            <th className="px-5 py-3.5 whitespace-nowrap">Return Status</th>
            <th className="px-5 py-3.5 whitespace-nowrap">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200 bg-white">
          {negotiations.length === 0 ? (
            <tr><td colSpan={6} className="px-5 py-8 text-center text-zinc-500 italic">No pending full returns found.</td></tr>
          ) : negotiations.map(n => {
            const timelineStr = (n.offers || []).map(o => `${o.percentage}% → rejected`).join(", ");
            return (
              <tr key={n.id} className="hover:bg-zinc-50/50 transition-colors">
                <td className="px-5 py-4 min-w-[200px]">
                  <div className="font-semibold text-zinc-900">{n.customerName !== "Unknown" ? n.customerName : "Customer"}</div>
                  <div className="text-xs text-zinc-500">{n.customerEmail}</div>
                </td>
                <td className="px-5 py-4 whitespace-nowrap">
                  {n.shopDomain && n.shopifyOrderId ? (
                     <a href={getShopifyLink(n.shopDomain, n.shopifyOrderId)} target="_blank" className="text-teal-600 hover:text-teal-700 font-semibold underline">
                       {n.orderNumber}
                     </a>
                  ) : <span className="font-semibold">{n.orderNumber}</span>}
                </td>
                <td className="px-5 py-4 text-xs text-zinc-500">
                  <div className="max-w-[250px] whitespace-normal">
                    {timelineStr ? timelineStr : 'No offers made (direct return)'}
                  </div>
                </td>
                <td className="px-5 py-4 text-xs text-zinc-600 max-w-[200px] truncate">
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
                     className="text-xs font-semibold rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1 focus:ring-2 focus:ring-teal-500 outline-none"
                   >
                     <option value="awaiting_processing">Awaiting Processing</option>
                     <option value="return_label_sent">Return Label Sent</option>
                     <option value="return_received">Return Received</option>
                     <option value="refunded">Refunded (Completed)</option>
                   </select>
                </td>
                <td className="px-5 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                     <Link href={`/dashboard/inbox/${n.conversationId}`} className="text-xs font-semibold rounded-md bg-zinc-100 text-zinc-700 px-3 py-1.5 hover:bg-zinc-200 transition-colors">
                       View Inbox
                     </Link>
                     {n.shopDomain && n.shopifyOrderId && (
                        <a href={getShopifyLink(n.shopDomain, n.shopifyOrderId)} target="_blank" className="text-xs font-semibold rounded-md border border-zinc-300 bg-white text-zinc-700 px-3 py-1.5 hover:bg-zinc-50 transition-colors">
                          Process in Shopify ↗
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

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 p-4 sm:p-6 pb-24 font-sans">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Returns & Negotiations</h1>
        <p className="text-sm text-zinc-500">Manage active negotiations, issue accepted partial refunds, and process full returns.</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Active Negotiations</h3>
          <p className="mt-2 text-3xl font-bold text-blue-600">{kpis?.activeCount ?? '-'}</p>
          <p className="mt-1 text-xs text-zinc-400">Conversations in progress</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/30 p-5 shadow-sm">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Saved Revenue</h3>
          <p className="mt-2 text-3xl font-bold text-emerald-600">{kpis ? formatCurrency(kpis.savedRevenue, "EUR") : '-'}</p>
          <p className="mt-1 text-xs text-emerald-600/70">Money kept from accepted offers</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Refunds Issued</h3>
          <p className="mt-2 text-3xl font-bold text-zinc-900">{kpis?.refundsIssued ?? '-'}</p>
          <p className="mt-1 text-xs text-zinc-400">Processed partial refunds</p>
        </div>
        <div className="rounded-xl border border-rose-200 bg-rose-50/30 p-5 shadow-sm">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-rose-700">Pending Returns</h3>
          <p className="mt-2 text-3xl font-bold text-rose-600">{kpis?.pendingReturns ?? '-'}</p>
          <p className="mt-1 text-xs text-rose-600/70">Rejected offers needing full return</p>
        </div>
      </div>

      {/* Tabs Layout */}
      <div className="flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm mt-4">
        <div className="flex border-b border-zinc-200 bg-zinc-50/50">
          <button 
            onClick={() => setActiveTab("active")}
            className={`flex-1 py-4 text-sm font-bold text-center border-b-2 transition-colors ${activeTab === 'active' ? 'border-blue-600 text-blue-700 bg-white' : 'border-transparent text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100/50'}`}
          >
            🔄 Active ({kpis?.activeCount ?? 0})
          </button>
          <button 
            onClick={() => setActiveTab("accepted")}
            className={`flex-1 py-4 text-sm font-bold text-center border-b-2 transition-colors ${activeTab === 'accepted' ? 'border-emerald-600 text-emerald-700 bg-white' : 'border-transparent text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100/50'}`}
          >
            ✅ Accepted
          </button>
          <button 
            onClick={() => setActiveTab("returns")}
            className={`flex-1 py-4 text-sm font-bold text-center border-b-2 transition-colors ${activeTab === 'returns' ? 'border-rose-600 text-rose-700 bg-white' : 'border-transparent text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100/50'}`}
          >
            📦 Returns to Process ({kpis?.pendingReturns ?? 0})
          </button>
        </div>

        <div className="relative min-h-[400px]">
          {loading && (
             <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/50 backdrop-blur-sm">
               <div className="w-8 h-8 rounded-full border-4 border-zinc-200 border-t-zinc-800 animate-spin"></div>
             </div>
          )}
          
          {activeTab === 'active' && renderActiveTable()}
          {activeTab === 'accepted' && renderAcceptedTable()}
          {activeTab === 'returns' && renderReturnsTable()}
        </div>
      </div>
    </div>
  );
}
