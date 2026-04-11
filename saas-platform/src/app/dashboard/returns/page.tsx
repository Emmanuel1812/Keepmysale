"use client";

import { useEffect, useState } from "react";

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
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  orderNumber: string;
  customerEmail: string;
  orderValue: string;
  currency: string;
  shopifyRefundId: string | null;
  shopifyOrderId: string | null;
  shopDomain: string;
  isManualRefundRequired: boolean;
  refundRejectionReason: string | null;
}

export default function ReturnsPage() {
  const [negotiations, setNegotiations] = useState<EnrichedNegotiation[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"All" | "Active" | "Completed" | "Expired">("All");
  const [selectedNeg, setSelectedNeg] = useState<EnrichedNegotiation | null>(null);
  const [processingRefund, setProcessingRefund] = useState(false);
  const [refundError, setRefundError] = useState<string | null>(null);

  async function loadNegotiations() {
    setLoading(true);
    try {
      const response = await fetch("/api/negotiations", { cache: "no-store" });
      const payload = await response.json();
      if (payload.success) {
        setNegotiations(payload.data?.negotiations ?? []);
      }
    } catch (err) {
      console.error("Failed to fetch negotiations", err);
    } finally {
      setLoading(false);
    }
  }

  const handleManualAction = async (negId: string, action: "approve" | "reject", reason?: string) => {
    if (processingRefund) return;
    setProcessingRefund(true);
    setRefundError(null);
    try {
      const response = await fetch(`/api/negotiations/${negId}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, rejectionReason: reason }),
      });
      const data = await response.json();
      if (data.success) {
        await loadNegotiations();
        setSelectedNeg(null);
      } else {
        setRefundError(data.error?.message || `Failed to ${action} refund.`);
      }
    } catch (err) {
      setRefundError("A network error occurred.");
    } finally {
      setProcessingRefund(false);
    }
  };

  useEffect(() => {
    void loadNegotiations();
  }, []);

  const totalSavings = negotiations.reduce((acc, neg) => acc + (neg.status === "completed" ? (neg.savings || 0) : 0), 0);
  const returnsPrevented = negotiations.filter((neg) => neg.status === "completed").length;
  const activeNegotiationsCount = negotiations.filter((neg) => ["initiated", "offer_sent", "offer_rejected"].includes(neg.status)).length;
  
  const closedCount = negotiations.filter(neg => ["completed", "expired", "return_initiated", "escalated"].includes(neg.status)).length;
  const successRate = closedCount > 0 ? (returnsPrevented / closedCount) * 100 : 0;

  const filteredNegotiations = negotiations.filter(neg => {
    if (filter === "All") return true;
    if (filter === "Active") return ["initiated", "offer_sent", "offer_rejected"].includes(neg.status);
    if (filter === "Completed") return neg.status === "completed";
    if (filter === "Expired") return ["expired", "return_initiated", "escalated"].includes(neg.status);
    return true;
  });

  const getStatusBadge = (neg: EnrichedNegotiation) => {
    const { status, isManualRefundRequired } = neg;
    
    if (isManualRefundRequired) {
      return <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20 animate-pulse">Action Required ⚡</span>;
    }

    switch (status) {
      case "offer_accepted":
        return <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20">Awaiting Sync</span>;
      case "offer_sent":
      case "initiated":
      case "offer_rejected":
        return <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">Offer Sent</span>;
      case "completed":
        return <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-600/20">Completed ✅</span>;
      case "return_initiated":
      case "escalated":
        return <span className="inline-flex items-center rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700 ring-1 ring-red-600/20">Return / Escalated</span>;
      case "expired":
      default:
        return <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-500">Expired</span>;
    }
  };

  const formatCurrency = (amount: number | string, currency: string) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || "EUR" }).format(Number(amount));
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };
  
  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 sm:p-6 pb-20 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">Returns & Negotiations</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Track how much money KeepMySale is saving you.</p>
        </div>
        <div className="flex w-full sm:w-auto">
          <select 
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
            className="w-full sm:w-auto rounded-md border border-zinc-200 py-1.5 pl-3 pr-8 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 dark:border-zinc-800 dark:bg-zinc-900/50"
          >
            <option value="All">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Completed">Completed</option>
            <option value="Expired">Expired / Returned</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-500 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/50">
          Loading returns integration data...
        </div>
      ) : negotiations.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-zinc-200 bg-white py-24 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900/50">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-50 mb-4 text-2xl dark:bg-zinc-800/50">
            🛡️
          </div>
          <h3 className="mb-2 text-lg font-medium text-zinc-900 dark:text-white">No negotiations yet</h3>
          <p className="mb-6 max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
            When a customer requests a return, KeepMySale will automatically negotiate to save you money.
            Negotiations will appear here with full timeline and savings tracking.
          </p>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/50">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Total Savings</h3>
              <p className="mt-2 text-2xl font-bold text-teal-600 dark:text-teal-500">{formatCurrency(totalSavings, "EUR")}</p>
              <p className="mt-1 text-xs text-zinc-400">Total money saved through negotiations</p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/50">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Returns Prevented</h3>
              <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                🛡️ {returnsPrevented}
              </p>
              <p className="mt-1 text-xs text-zinc-400">Orders kept by customers</p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/50">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Active Negotiations</h3>
              <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                🔄 {activeNegotiationsCount}
              </p>
              <p className="mt-1 text-xs text-zinc-400">Currently in progress</p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/50">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Success Rate</h3>
              <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                📈 {successRate.toFixed(1)}%
              </p>
              <p className="mt-1 text-xs text-zinc-400">Negotiation acceptance rate</p>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900/50">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-zinc-50 text-left text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:bg-zinc-900/80">
                  <tr>
                    <th className="px-5 py-3.5 whitespace-nowrap">Date</th>
                    <th className="px-5 py-3.5 whitespace-nowrap">Order</th>
                    <th className="px-5 py-3.5 whitespace-nowrap">Customer</th>
                    <th className="px-5 py-3.5 whitespace-nowrap text-right">Order Value</th>
                    <th className="px-5 py-3.5 whitespace-nowrap">Status</th>
                    <th className="px-5 py-3.5 whitespace-nowrap">Current Step</th>
                    <th className="px-5 py-3.5 whitespace-nowrap text-right">Offered</th>
                    <th className="px-5 py-3.5 whitespace-nowrap text-right text-emerald-600">Savings</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {filteredNegotiations.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-5 py-8 text-center text-zinc-500">No negotiations found for this filter.</td>
                    </tr>
                  ) : filteredNegotiations.map((neg) => {
                    const latestOffer = neg.offers && neg.offers.length > 0 ? neg.offers[neg.offers.length - 1] : null;
                    const offeredAmount = latestOffer?.amount || 0;
                    
                    return (
                      <tr 
                        key={neg.id} 
                        onClick={() => setSelectedNeg(neg)}
                        className="group cursor-pointer transition-colors hover:bg-zinc-50/70 even:bg-zinc-50/30 dark:hover:bg-zinc-800/40 dark:even:bg-zinc-900/20"
                      >
                        <td className="whitespace-nowrap px-5 py-4 text-zinc-500 dark:text-zinc-400">
                          {formatDate(neg.updatedAt || neg.createdAt)}
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 font-semibold text-teal-600 hover:text-teal-700 transition-colors dark:text-teal-500 dark:hover:text-teal-400">
                          {neg.orderNumber !== "Unknown" ? neg.orderNumber : `#${neg.id.substring(0, 8)}`}
                        </td>
                        <td className="px-5 py-4 text-zinc-900 dark:text-zinc-300 truncate max-w-[150px]">
                          {neg.customerEmail}
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 text-right font-medium text-zinc-900 dark:text-white">
                          {formatCurrency(neg.orderValue, neg.currency)}
                        </td>
                        <td className="whitespace-nowrap px-5 py-4">
                          {getStatusBadge(neg)}
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 text-zinc-600 dark:text-zinc-400 text-xs">
                          {neg.currentStep > 0 ? `Step ${neg.currentStep} (${latestOffer?.percentage || 0}%)` : "Initiating"}
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 text-right text-zinc-600 dark:text-zinc-400">
                          {offeredAmount > 0 ? formatCurrency(offeredAmount, neg.currency) : "-"}
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 text-right font-semibold">
                          {neg.status === "completed" && neg.savings !== null ? (
                            <span className="text-emerald-600">{formatCurrency(neg.savings, neg.currency)}</span>
                          ) : (
                            <span className="text-zinc-400">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Detail Modal */}
      {selectedNeg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setSelectedNeg(null)}>
          <div 
            className="w-full max-w-lg rounded-xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-900"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-xl font-bold text-zinc-900 dark:text-white">
                  Negotiation: {selectedNeg.orderNumber !== "Unknown" ? selectedNeg.orderNumber : `#${selectedNeg.id.substring(0, 8)}`}
                </h2>
                <p className="text-sm text-zinc-500">Customer: {selectedNeg.customerEmail}</p>
                <p className="text-sm text-zinc-500">Order Value: {formatCurrency(selectedNeg.orderValue, selectedNeg.currency)}</p>
              </div>
              <div>
                {getStatusBadge(selectedNeg)}
              </div>
            </div>

            <div className="mb-6 relative">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-white mb-4">Timeline:</h3>
              <div className="absolute left-3.5 top-10 bottom-0 w-px bg-zinc-200 dark:bg-zinc-800"></div>
              
              <div className="flex flex-col gap-6">
                {(selectedNeg.offers || []).map((offer, idx) => (
                  <div key={idx} className="relative pl-10">
                    <div className="absolute left-[11px] top-1.5 w-2 h-2 rounded-full bg-teal-500 ring-4 ring-white dark:ring-zinc-900"></div>
                    <p className="text-sm font-medium text-zinc-900 dark:text-white">
                      Step {offer.step}: Offered {offer.percentage}% ({formatCurrency(offer.amount, offer.currency)})
                    </p>
                    <p className="text-xs text-zinc-500 mt-1 capitalize">
                      Customer response: {offer.response === 'pending' ? 'Pending Action' : 
                                       offer.response === 'accepted' ? 'Accepted ✅' : 
                                       offer.response === 'rejected' ? 'Rejected ❌' : offer.response}
                    </p>
                    <p className="text-xs text-zinc-400 mt-1">{formatDateTime(offer.offered_at)}</p>
                  </div>
                ))}

                {selectedNeg.status === 'completed' && selectedNeg.completedAt && (
                   <div className="relative pl-10">
                   <div className="absolute left-[11px] top-1.5 w-2 h-2 rounded-full bg-emerald-500 ring-4 ring-white dark:ring-zinc-900"></div>
                   <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                     Refund Processed: {formatCurrency(selectedNeg.offers[selectedNeg.offers.length - 1]?.amount || 0, selectedNeg.currency)}
                   </p>
                   {selectedNeg.shopifyRefundId && (
                     <p className="text-xs text-zinc-500 mt-1">Shopify Refund ID: #{selectedNeg.shopifyRefundId}</p>
                   )}
                   <p className="text-xs text-zinc-400 mt-1">{formatDateTime(selectedNeg.completedAt)}</p>
                 </div>
                )}
                
                {selectedNeg.status === 'return_initiated' && (
                  <div className="relative pl-10">
                    <div className="absolute left-[11px] top-1.5 w-2 h-2 rounded-full bg-red-500 ring-4 ring-white dark:ring-zinc-900"></div>
                    <p className="text-sm font-medium text-red-600 dark:text-red-400">
                      Full Return Started
                    </p>
                  </div>
                )}
              </div>
            </div>

            {selectedNeg.status === "completed" && selectedNeg.savings !== null && (
              <div className="mt-6 rounded-lg bg-emerald-50 border border-emerald-100 p-4 dark:bg-emerald-900/20 dark:border-emerald-800/50">
                <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
                  💰 Savings: {formatCurrency(selectedNeg.savings, selectedNeg.currency)}
                </p>
                <p className="text-xs text-emerald-600/80 dark:text-emerald-500/80 mt-1">(Order value - partial refund)</p>
              </div>
            )}

            {selectedNeg.isManualRefundRequired && (
              <div className="mt-6 space-y-3">
                <div className="rounded-lg bg-amber-50 border border-amber-100 p-4 dark:bg-amber-900/20 dark:border-amber-800/50">
                  <p className="text-sm font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-2">
                    ⚡ Offer Accepted - Manual Approval Required
                  </p>
                  <p className="text-xs text-amber-700 mt-1">
                    The customer has agreed to a partial refund of <strong>{formatCurrency(selectedNeg.offers[selectedNeg.offers.length - 1]?.amount || 0, selectedNeg.currency)}</strong>. 
                    Review the negotiation details below before issuing the refund.
                  </p>
                  {refundError && <p className="mt-2 text-xs font-bold text-red-600">{refundError}</p>}
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => handleManualAction(selectedNeg.id, "approve")}
                    disabled={processingRefund}
                    className="flex items-center justify-center gap-2 rounded-md bg-teal-600 py-3 text-sm font-bold text-white hover:bg-teal-700 transition-colors disabled:opacity-50 shadow-sm"
                  >
                    {processingRefund ? "Processing..." : "Approve Refund"}
                  </button>
                  <button 
                    onClick={() => {
                      const reason = window.prompt("Reason for rejection (sent to audit log):");
                      if (reason !== null) handleManualAction(selectedNeg.id, "reject", reason);
                    }}
                    disabled={processingRefund}
                    className="flex items-center justify-center gap-2 rounded-md border border-zinc-200 bg-white py-3 text-sm font-bold text-zinc-700 hover:bg-zinc-50 transition-colors disabled:opacity-50"
                  >
                    Reject & Escalated
                  </button>
                </div>

                <div className="text-center">
                   {selectedNeg.shopDomain && selectedNeg.shopifyOrderId ? (
                     <a 
                      href={`https://admin.shopify.com/store/${selectedNeg.shopDomain.split('.')[0]}/orders/${selectedNeg.shopifyOrderId.split('/').pop()}`}
                      target="_blank"
                      className="text-xs text-zinc-400 hover:text-teal-600 underline"
                     >
                      View Order in Shopify Admin &rarr;
                     </a>
                   ) : (
                    <span className="text-xs text-zinc-300 italic">No Shopify order link available</span>
                   )}
                </div>
              </div>
            )}

            <button 
              onClick={() => {
                setSelectedNeg(null);
                setRefundError(null);
              }}
              className="mt-4 w-full rounded-md bg-zinc-100 py-2.5 text-sm font-medium text-zinc-900 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-white dark:hover:bg-zinc-700 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
