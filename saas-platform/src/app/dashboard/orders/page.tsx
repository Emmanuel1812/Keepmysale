"use client";

import { useEffect, useState } from "react";
import { FulfillmentBadge, FinancialBadge } from "@/components/ui/status-badges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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

export default function OrdersPage() {
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  
  // Side Panel State
  const [selectedOrder, setSelectedOrder] = useState<OrderItem | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  
  // Refund State
  const [refundAmount, setRefundAmount] = useState("");
  const [refunding, setRefunding] = useState(false);

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
  }, []);

  async function handleSync() {
    if (syncing) return;
    setSyncing(true);
    setSyncStatus(null);
    
    try {
      await fetch("/api/shopify/sync-orders", { method: "POST" });
      await fetch("/api/automation/sync-emails", { method: "POST" });
      setSyncStatus({ type: 'success', message: 'Sync completed successfully!' });
      await loadOrders();
    } catch (err) {
      setSyncStatus({ type: 'error', message: 'Sync failed.' });
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncStatus(null), 5000);
    }
  }

  async function handleRefund() {
    if (!selectedOrder || !refundAmount || refunding) return;
    
    if (!confirm(`Are you sure you want to refund ${selectedOrder.currency} ${refundAmount} for order ${selectedOrder.shopifyOrderNumber}?`)) {
      return;
    }

    setRefunding(true);
    try {
      const res = await fetch("/api/shopify/order/refund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: selectedOrder.shopifyOrderId,
          amount: refundAmount,
          currency: selectedOrder.currency
        })
      });

      const data = await res.json();
      if (data.success) {
        alert("Refund successful! It may take a few minutes to reflect in Shopify.");
        setRefundAmount("");
        await loadOrders();
        setIsPanelOpen(false);
      } else {
        alert(`Refund failed: ${data.error?.message || "Unknown error"}`);
      }
    } catch (err) {
      alert("An error occurred while processing the refund.");
    } finally {
      setRefunding(false);
    }
  }

  const openPanel = (order: OrderItem) => {
    setSelectedOrder(order);
    setIsPanelOpen(true);
    setRefundAmount("");
  };

  const closePanel = () => {
    setIsPanelOpen(false);
    setSelectedOrder(null);
  };

  const totalRevenue = orders.reduce((acc, order) => acc + Number(order.totalPrice || 0), 0);

  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 sm:p-6 pb-20 font-sans animate-in fade-in duration-500">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#111827]">Order History</h1>
            <p className="text-sm text-zinc-500">Detailed view of your synced store transactions.</p>
          </div>
          <button 
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 shadow-md shadow-teal-600/20 transition-all disabled:opacity-50"
          >
            <svg className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {syncing ? "Syncing..." : "Sync All Data"}
          </button>
        </div>

        {syncStatus && (
          <div className={`p-4 rounded-xl text-sm font-medium animate-in slide-in-from-top-2 ${syncStatus.type === 'success' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
            {syncStatus.message}
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-zinc-200/60 shadow-xs">
            <CardHeader className="p-4 pb-0">
               <CardDescription className="text-[10px] uppercase font-bold tracking-widest">Total Orders</CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-1">
              <p className="text-2xl font-bold">{orders.length}</p>
            </CardContent>
          </Card>
          <Card className="border-zinc-200/60 shadow-xs">
            <CardHeader className="p-4 pb-0">
               <CardDescription className="text-[10px] uppercase font-bold tracking-widest">Total Revenue</CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-1">
              <p className="text-2xl font-bold">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totalRevenue)}</p>
            </CardContent>
          </Card>
          <Card className="border-zinc-200/60 shadow-xs">
            <CardHeader className="p-4 pb-0">
               <CardDescription className="text-[10px] uppercase font-bold tracking-widest">Fulfilled</CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-1 text-green-600">
              <p className="text-2xl font-bold">{orders.filter(o => o.fulfillmentStatus === 'fulfilled').length}</p>
            </CardContent>
          </Card>
          <Card className="border-zinc-200/60 shadow-xs">
            <CardHeader className="p-4 pb-0">
               <CardDescription className="text-[10px] uppercase font-bold tracking-widest">Pending Sync</CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-1 text-amber-600">
              <p className="text-2xl font-bold">{orders.filter(o => !o.fulfillmentStatus).length}</p>
            </CardContent>
          </Card>
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-lg shadow-zinc-200/40">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-zinc-50 border-b border-zinc-100 text-left text-[11px] font-bold uppercase tracking-widest text-zinc-400">
                <tr>
                  <th className="px-6 py-4">Order</th>
                  <th className="px-6 py-4">Customer</th>
                  <th className="px-6 py-4 text-right">Amount</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Tracking</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {orders.map((order) => (
                  <tr 
                    key={order.id} 
                    onClick={() => openPanel(order)}
                    className="group cursor-pointer transition-all hover:bg-teal-50/30"
                  >
                    <td className="px-6 py-5">
                      <div className="flex flex-col">
                        <span className="font-bold text-zinc-900 group-hover:text-teal-700">{order.shopifyOrderNumber ?? `#${order.id.substring(0,6)}`}</span>
                        <span className="text-[10px] text-zinc-400 uppercase font-medium">{new Date(order.createdAt).toLocaleDateString()}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex flex-col">
                        <span className="font-medium text-zinc-900">{order.customerName || "No Name"}</span>
                        <span className="text-xs text-zinc-400">{order.email}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-right font-bold text-zinc-900">
                      {order.totalPrice ? new Intl.NumberFormat('en-US', { style: 'currency', currency: order.currency }).format(Number(order.totalPrice)) : "-"}
                    </td>
                    <td className="px-6 py-5">
                       <div className="flex gap-2">
                        <FinancialBadge status={order.financialStatus} />
                        <FulfillmentBadge status={order.fulfillmentStatus} />
                       </div>
                    </td>
                    <td className="px-6 py-5">
                      {order.trackingNumber ? (
                        <Badge className="bg-zinc-100 text-zinc-600 border-none font-mono text-[10px]">{order.trackingNumber}</Badge>
                      ) : (
                        <span className="text-zinc-300">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* --- SIDE PANEL (ORDER DETAILS) --- */}
      {isPanelOpen && selectedOrder && (
        <>
          {/* Overlay */}
          <div className="fixed inset-0 z-50 bg-zinc-900/40 backdrop-blur-sm transition-opacity" onClick={closePanel} />
          
          {/* Panel */}
          <div className="fixed right-0 top-0 z-50 h-full w-full max-w-lg bg-zinc-50 shadow-2xl animate-in slide-in-from-right duration-300 overflow-y-auto">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-4">
              <div>
                <h2 className="text-lg font-bold text-zinc-900">Order {selectedOrder.shopifyOrderNumber}</h2>
                <p className="text-xs text-zinc-500">Placed on {new Date(selectedOrder.createdAt).toLocaleString()}</p>
              </div>
              <button onClick={closePanel} className="rounded-full p-2 hover:bg-zinc-100">
                <svg className="h-5 w-5 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Customer Info Card */}
              <Card className="border-zinc-200 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Customer Info</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-500">Name</span>
                    <span className="font-bold">{selectedOrder.customerName || "Unknown"}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-500">Email</span>
                    <span className="font-medium underline text-teal-600">{selectedOrder.email}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-500">Payment Via</span>
                    <Badge variant="outline" className="capitalize">{selectedOrder.paymentGateway?.replace(/_/g, ' ') || "Unknown"}</Badge>
                  </div>
                </CardContent>
              </Card>

              {/* Line Items Card */}
              <Card className="border-zinc-200 shadow-sm overflow-hidden">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Order Items</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <table className="w-full text-sm">
                    <thead className="bg-zinc-50 text-left text-[10px] font-bold uppercase text-zinc-400">
                      <tr>
                        <th className="px-4 py-2 text-zinc-500">Product</th>
                        <th className="px-4 py-2 text-center">Qty</th>
                        <th className="px-4 py-2 text-right">Price</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {(selectedOrder.lineItems as any[] || []).map((item, idx) => (
                        <tr key={idx}>
                          <td className="px-4 py-3">
                             <p className="font-medium text-zinc-900">{item.title}</p>
                             <p className="text-[10px] text-zinc-400">SKU: {item.sku || "N/A"}</p>
                          </td>
                          <td className="px-4 py-3 text-center">{item.quantity}</td>
                          <td className="px-4 py-3 text-right font-medium">
                            {new Intl.NumberFormat('en-US', { style: 'currency', currency: selectedOrder.currency }).format(Number(item.price))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="bg-zinc-100/50 px-4 py-3 flex justify-between items-center border-t border-zinc-100">
                    <span className="text-xs font-bold uppercase text-zinc-500">Order Total</span>
                    <span className="text-lg font-black text-zinc-900">
                      {new Intl.NumberFormat('en-US', { style: 'currency', currency: selectedOrder.currency }).format(Number(selectedOrder.totalPrice))}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Partial Refund Section */}
              <div className="pt-4">
                 <div className="mb-4">
                    <h3 className="text-sm font-bold text-zinc-900">Issue Partial Refund</h3>
                    <p className="text-xs text-zinc-500">Quickly process a refund without leaving the dashboard.</p>
                 </div>
                 
                 {selectedOrder.paymentGateway === "shopify_payments" ? (
                   <div className="space-y-4 rounded-2xl border border-teal-100 bg-teal-50/50 p-5 shadow-inner">
                      <div className="space-y-2">
                         <label className="text-xs font-bold text-teal-800 uppercase tracking-wide">Refund Amount ({selectedOrder.currency})</label>
                         <Input 
                            type="number" 
                            placeholder="0.00" 
                            className="bg-white border-teal-200 focus:ring-teal-500 font-bold"
                            value={refundAmount}
                            onChange={(e) => setRefundAmount(e.target.value)}
                         />
                         <p className="text-[10px] text-teal-600">This order was paid with Shopify Payments and is eligible for direct refund.</p>
                      </div>
                      <Button 
                        className="w-full bg-teal-600 hover:bg-teal-700 text-white shadow-lg shadow-teal-600/20"
                        disabled={!refundAmount || refunding}
                        onClick={handleRefund}
                      >
                        {refunding ? "Processing..." : "Confirm Partial Refund"}
                      </Button>
                   </div>
                 ) : (
                   <div className="rounded-2xl border border-zinc-200 bg-zinc-100 p-5 text-center">
                      <p className="text-xs text-zinc-500">This order was paid via <span className="font-bold">{selectedOrder.paymentGateway || "External Gateway"}</span>. Please process refunds directly in your Shopify Admin.</p>
                      <Button variant="outline" className="mt-4 text-[10px] uppercase font-bold" onClick={() => window.open(`https://admin.shopify.com/store/${selectedOrder.shopifyOrderId.split('/')[2]}/orders/${selectedOrder.shopifyOrderId.split('/').pop()}`, '_blank')}>
                        Open Shopify Admin
                      </Button>
                   </div>
                 )}
              </div>

            </div>
          </div>
        </>
      )}
    </div>
  );
}
