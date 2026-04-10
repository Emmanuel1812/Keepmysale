"use client";

import { useState } from "react";

export function ShopifyConnectCard() {
  const [shop, setShop] = useState("");
  const [loading, setLoading] = useState(false);

  async function startOAuth() {
    if (!shop.trim() || loading) return;
    setLoading(true);
    try {
      window.location.href = `/api/shopify/install?shop=${encodeURIComponent(shop)}`;
      return;
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
      <div className="border-b border-zinc-200 bg-white px-6 py-5">
        <h3 className="text-lg font-bold text-[#111827]">Connect Shopify</h3>
        <p className="mt-1 text-sm text-zinc-500">Connect your store using OAuth to sync orders, customers, and support metadata.</p>
      </div>
      <div className="p-6 grid gap-5 bg-white">
        <label className="grid gap-1.5 text-sm font-semibold text-[#111827]">
          Shopify domain
          <input
            className="w-full rounded-lg border border-zinc-200 bg-[#f8fafb] px-3 py-2 text-sm text-[#111827] outline-none transition-all placeholder:text-zinc-400 focus:border-teal-500 focus:bg-white focus:ring-2 focus:ring-teal-500/20"
            placeholder="your-store.myshopify.com"
            value={shop}
            onChange={(event) => setShop(event.target.value)}
          />
        </label>
        
        <div className="mt-2 flex items-center justify-end border-t border-zinc-100 pt-5">
          <button 
            className="flex items-center justify-center rounded-lg bg-[#111827] px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-black disabled:opacity-50"
            onClick={startOAuth} 
            disabled={loading || !shop}
          >
            {loading ? "Redirecting..." : "Start Shopify OAuth"}
          </button>
        </div>
      </div>
    </div>
  );
}
