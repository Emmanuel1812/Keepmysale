"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

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
    <Card>
      <CardHeader>
        <CardTitle>Connect Shopify</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          Connect your store using OAuth to sync orders, customers, and support metadata.
        </p>
        <Input
          placeholder="your-store.myshopify.com"
          value={shop}
          onChange={(event) => setShop(event.target.value)}
        />
        <Button onClick={startOAuth} disabled={loading}>
          {loading ? "Redirecting..." : "Start Shopify OAuth"}
        </Button>
      </CardContent>
    </Card>
  );
}
