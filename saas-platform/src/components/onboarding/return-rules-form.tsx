"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ReturnRulesForm() {
  const router = useRouter();
  const [merchantName, setMerchantName] = useState("");
  const [shopDomain, setShopDomain] = useState("");
  const [supportEmail, setSupportEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function submitConfiguration() {
    if (!merchantName || !shopDomain || !supportEmail || saving) return;
    setSaving(true);
    setErrorMessage(null);
    try {
      const response = await fetch("/api/merchant/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          merchantName,
          shopDomain,
          supportEmail,
          step1Percentage: 20,
          step2Percentage: 35,
          step3Percentage: 50,
        }),
      });
      const payload = (await response.json()) as {
        success: boolean;
        error?: { message?: string };
      };
      if (payload.success) {
        // Redirect immediately after onboarding success; order sync runs best-effort.
        void fetch("/api/shopify/sync-orders", { method: "POST" });
        router.replace("/onboarding?step=email");
        return;
      }
      setErrorMessage(payload.error?.message ?? "Could not save configuration.");
    } catch {
      setErrorMessage("Could not save configuration.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
      <div className="border-b border-zinc-200 bg-white px-6 py-5">
        <h3 className="text-lg font-bold text-[#111827]">Negotiation Configuration</h3>
        <p className="mt-1 text-sm text-zinc-500">Configure your store details. You can fine-tune return percentages later in Settings.</p>
      </div>
      <div className="p-6 grid gap-5 bg-white">
        <label className="grid gap-1.5 text-sm font-semibold text-[#111827]">
          Merchant name
          <input
            className="w-full rounded-lg border border-zinc-200 bg-[#f8fafb] px-3 py-2 text-sm text-[#111827] outline-none transition-all placeholder:text-zinc-400 focus:border-teal-500 focus:bg-white focus:ring-2 focus:ring-teal-500/20"
            value={merchantName}
            onChange={(event) => setMerchantName(event.target.value)}
          />
        </label>
        
        <label className="grid gap-1.5 text-sm font-semibold text-[#111827]">
          Shopify domain
          <input
            className="w-full rounded-lg border border-zinc-200 bg-[#f8fafb] px-3 py-2 text-sm text-[#111827] outline-none transition-all placeholder:text-zinc-400 focus:border-teal-500 focus:bg-white focus:ring-2 focus:ring-teal-500/20"
            placeholder="your-store.myshopify.com"
            value={shopDomain}
            onChange={(event) => setShopDomain(event.target.value)}
          />
        </label>
        
        <label className="grid gap-1.5 text-sm font-semibold text-[#111827]">
          Support email
          <input
            className="w-full rounded-lg border border-zinc-200 bg-[#f8fafb] px-3 py-2 text-sm text-[#111827] outline-none transition-all placeholder:text-zinc-400 focus:border-teal-500 focus:bg-white focus:ring-2 focus:ring-teal-500/20"
            type="email"
            placeholder="support@yourdomain.com"
            value={supportEmail}
            onChange={(event) => setSupportEmail(event.target.value)}
          />
        </label>

        <div className="mt-2 flex items-center justify-between border-t border-zinc-100 pt-5">
          {errorMessage ? <p className="text-sm font-medium text-red-600">{errorMessage}</p> : <div />}
          <button 
            className="flex items-center justify-center rounded-lg bg-[#111827] px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-black disabled:opacity-50"
            onClick={submitConfiguration} 
            disabled={saving || !merchantName || !shopDomain || !supportEmail}
          >
            {saving ? "Saving..." : "Save configuration"}
          </button>
        </div>
      </div>
    </div>
  );
}
