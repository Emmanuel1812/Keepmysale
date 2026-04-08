"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export function ReturnRulesForm() {
  const router = useRouter();
  const [merchantName, setMerchantName] = useState("");
  const [shopDomain, setShopDomain] = useState("");
  const [supportEmail, setSupportEmail] = useState("");
  const [step1Percentage, setStep1Percentage] = useState(20);
  const [step2Percentage, setStep2Percentage] = useState(35);
  const [step3Percentage, setStep3Percentage] = useState(50);
  const [saving, setSaving] = useState(false);

  async function submitConfiguration() {
    if (!merchantName || !shopDomain || !supportEmail || saving) return;
    setSaving(true);
    try {
      const response = await fetch("/api/merchant/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          merchantName,
          shopDomain,
          supportEmail,
          step1Percentage,
          step2Percentage,
          step3Percentage,
        }),
      });
      const payload = (await response.json()) as { success: boolean };
      if (payload.success) {
        await fetch("/api/shopify/sync-orders", { method: "POST" });
        router.push("/dashboard");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Negotiation Configuration</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        <label className="grid gap-1 text-sm">
          Merchant name
          <Input value={merchantName} onChange={(event) => setMerchantName(event.target.value)} />
        </label>
        <label className="grid gap-1 text-sm">
          Shopify domain
          <Input
            placeholder="your-store.myshopify.com"
            value={shopDomain}
            onChange={(event) => setShopDomain(event.target.value)}
          />
        </label>
        <label className="grid gap-1 text-sm">
          Support email
          <Input
            type="email"
            placeholder="support@yourdomain.com"
            value={supportEmail}
            onChange={(event) => setSupportEmail(event.target.value)}
          />
        </label>
        <label className="grid gap-1 text-sm">
          Step 1 percentage
          <Input
            type="number"
            min={0}
            max={100}
            value={step1Percentage}
            onChange={(event) => setStep1Percentage(Number(event.target.value))}
          />
        </label>
        <label className="grid gap-1 text-sm">
          Step 2 percentage
          <Input
            type="number"
            min={0}
            max={100}
            value={step2Percentage}
            onChange={(event) => setStep2Percentage(Number(event.target.value))}
          />
        </label>
        <label className="grid gap-1 text-sm">
          Step 3 percentage
          <Input
            type="number"
            min={0}
            max={100}
            value={step3Percentage}
            onChange={(event) => setStep3Percentage(Number(event.target.value))}
          />
        </label>
        <Button className="w-fit" onClick={submitConfiguration} disabled={saving}>
          {saving ? "Saving..." : "Save configuration"}
        </Button>
      </CardContent>
    </Card>
  );
}
