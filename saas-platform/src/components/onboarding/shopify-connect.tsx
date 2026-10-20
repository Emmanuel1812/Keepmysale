"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StepCard } from "@/components/onboarding/step-indicator";

export function ShopifyConnectCard() {
  const [shop, setShop] = useState("");
  const [loading, setLoading] = useState(false);

  function startOAuth() {
    if (!shop.trim() || loading) return;
    setLoading(true);
    window.location.href = `/api/shopify/install?shop=${encodeURIComponent(shop.trim())}`;
  }

  return (
    <StepCard title="Connect your Shopify store" description="KeepMySale reads your orders and customers so it can answer order questions and value returns.">
      <label className="grid gap-1.5">
        <span className="text-[13px] font-medium text-foreground">Store address</span>
        <Input
          placeholder="your-store.myshopify.com"
          value={shop}
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => setShop(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && startOAuth()}
        />
        <span className="text-xs text-muted">You approve the connection in Shopify on the next screen.</span>
      </label>

      <div className="flex justify-end border-t border-line pt-5">
        <Button onClick={startOAuth} disabled={!shop.trim()} loading={loading}>
          {loading ? "Opening Shopify" : "Connect Shopify"}
        </Button>
      </div>
    </StepCard>
  );
}
