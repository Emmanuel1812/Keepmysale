"use client";

import { useEffect, useState } from "react";
import { FulfillmentBadge, FinancialBadge } from "@/components/ui/status-badges";

interface OrderItem {
  id: string;
  shopifyOrderNumber: string | null;
  email: string | null;
  totalPrice: string | null;
  currency: string;
  financialStatus: string | null;
  fulfillmentStatus: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  createdAt: string;
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadOrders() {
      try {
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
    void loadOrders();
  }, []);

  const totalOrders = orders.length;
  const totalRevenue = orders.reduce((acc, order) => acc + (Number(order.totalPrice) || 0), 0);
  const fulfilledOrders = orders.filter(o => o.fulfillmentStatus?.toLowerCase() === 'fulfilled').length;
  const pendingOrders = orders.filter(o => !o.fulfillmentStatus || o.fulfillmentStatus?.toLowerCase() === 'unfulfilled').length;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 sm:p-6 pb-20 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">Orders</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Synced from Shopify</p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <span className="absolute inset-y-0 left-3 flex items-center text-zinc-400">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
            <input 
              type="text" 
              placeholder="Search..." 
              className="w-full rounded-md border border-zinc-200 py-1.5 pl-9 pr-3 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 dark:border-zinc-800 dark:bg-zinc-900/50" 
            />
          </div>
          <button className="flex w-full sm:w-auto justify-center items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-900 hover:bg-zinc-50 shadow-sm outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-1 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white dark:hover:bg-zinc-800 transition-colors">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Sync Orders
          </button>
        </div>
      </div>

      {loading ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-500 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/50">
          Loading orders...
        </div>
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-zinc-200 bg-white py-24 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900/50">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-50 mb-4 text-2xl dark:bg-zinc-800/50">
            📦
          </div>
          <h3 className="mb-2 text-lg font-medium text-zinc-900 dark:text-white">No orders synced yet</h3>
          <p className="mb-6 max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
            Connect your Shopify store and click Sync Orders to get started.
          </p>
          <button className="rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 shadow-sm transition-colors">
            Sync Orders
          </button>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/50">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Total Orders</h3>
              <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-white">{totalOrders}</p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/50">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Total Revenue</h3>
              <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-white">
                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totalRevenue)}
              </p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/50">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Fulfilled</h3>
              <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-white">{fulfilledOrders}</p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/50">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Pending</h3>
              <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-white">{pendingOrders}</p>
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
                    <th className="px-5 py-3.5 whitespace-nowrap text-right">Amount</th>
                    <th className="px-5 py-3.5 whitespace-nowrap">Payment</th>
                    <th className="px-5 py-3.5 whitespace-nowrap">Fulfillment</th>
                    <th className="px-5 py-3.5 whitespace-nowrap">Tracking</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {orders.map((order) => (
                    <tr 
                      key={order.id} 
                      className="group transition-colors hover:bg-zinc-50/70 even:bg-zinc-50/30 dark:hover:bg-zinc-800/40 dark:even:bg-zinc-900/20"
                    >
                      <td className="whitespace-nowrap px-5 py-4 text-zinc-500 dark:text-zinc-400">
                        {order.createdAt ? new Date(order.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : "-"}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 font-semibold text-teal-600 hover:text-teal-700 transition-colors dark:text-teal-500 dark:hover:text-teal-400">
                        <a href={`#`} className="cursor-pointer">
                          {order.shopifyOrderNumber ?? `#${order.id.substring(0, 8)}`}
                        </a>
                      </td>
                      <td className="px-5 py-4 text-zinc-900 dark:text-zinc-300">
                        {order.email ?? "-"}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-right font-medium text-zinc-900 dark:text-white">
                        {order.totalPrice ? new Intl.NumberFormat('en-US', { style: 'currency', currency: order.currency }).format(Number(order.totalPrice)) : "-"}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4">
                        <FinancialBadge status={order.financialStatus} />
                      </td>
                      <td className="whitespace-nowrap px-5 py-4">
                        <FulfillmentBadge status={order.fulfillmentStatus} />
                      </td>
                      <td className="px-5 py-4 text-zinc-600 dark:text-zinc-400">
                        {order.trackingUrl ? (
                          <a 
                            href={order.trackingUrl} 
                            target="_blank" 
                            rel="noreferrer" 
                            className="flex items-center gap-1 text-teal-600 hover:text-teal-700 hover:underline transition-colors dark:text-teal-500 dark:hover:text-teal-400"
                          >
                            <span className="truncate max-w-[120px] inline-block">{order.trackingNumber}</span>
                            <span className="text-xs">🔗</span>
                          </a>
                        ) : (
                          order.trackingNumber ? <span className="truncate max-w-[140px] inline-block">{order.trackingNumber}</span> : <span className="text-zinc-400">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Pagination Placeholder */}
            <div className="flex items-center justify-between border-t border-zinc-200 bg-white px-5 py-3 dark:border-zinc-800 dark:bg-zinc-900/50">
              <span className="text-sm text-zinc-500 dark:text-zinc-400">
                Showing 1-{orders.length} of {orders.length} orders
              </span>
              <div className="flex gap-2 text-sm text-zinc-400">
                <button className="rounded px-2 py-1 hover:bg-zinc-100 disabled:opacity-50 dark:hover:bg-zinc-800" disabled>Previous</button>
                <button className="rounded px-2 py-1 hover:bg-zinc-100 disabled:opacity-50 dark:hover:bg-zinc-800" disabled>Next</button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
