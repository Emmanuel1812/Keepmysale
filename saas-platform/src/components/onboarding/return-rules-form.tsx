"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StepCard } from "@/components/onboarding/step-indicator";

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
      setErrorMessage(payload.error?.message ?? "Could not save your details. Try again.");
    } catch {
      setErrorMessage("Could not save your details. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <StepCard title="Your store" description="How KeepMySale signs its replies. Return offers start at 20%, 35% and 50%; you can change them later in Settings.">
      <label className="grid gap-1.5">
        <span className="text-[13px] font-medium text-foreground">Store name</span>
        <Input value={merchantName} onChange={(event) => setMerchantName(event.target.value)} placeholder="Your brand" />
      </label>

      <label className="grid gap-1.5">
        <span className="text-[13px] font-medium text-foreground">Shopify address</span>
        <Input placeholder="your-store.myshopify.com" value={shopDomain} spellCheck={false} onChange={(event) => setShopDomain(event.target.value)} />
      </label>

      <label className="grid gap-1.5">
        <span className="text-[13px] font-medium text-foreground">Support email</span>
        <Input type="email" placeholder="support@yourstore.com" value={supportEmail} onChange={(event) => setSupportEmail(event.target.value)} />
      </label>

      <div className="flex items-center justify-between gap-4 border-t border-line pt-5">
        {errorMessage ? <p role="alert" className="text-sm font-medium text-lost">{errorMessage}</p> : <span />}
        <Button onClick={submitConfiguration} disabled={!merchantName || !shopDomain || !supportEmail} loading={saving}>
          {saving ? "Saving" : "Continue"}
        </Button>
      </div>
    </StepCard>
  );
}
