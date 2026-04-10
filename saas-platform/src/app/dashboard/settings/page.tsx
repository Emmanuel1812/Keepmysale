"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function SettingsPage() {
  const router = useRouter();
  const [shopName, setShopName] = useState("");
  const [email, setEmail] = useState("");
  const [autoReturnRequests, setAutoReturnRequests] = useState(true);
  const [step1Percentage, setStep1Percentage] = useState(20);
  const [step2Percentage, setStep2Percentage] = useState(35);
  const [step3Percentage, setStep3Percentage] = useState(50);
  const [googleEmail, setGoogleEmail] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);
  const [successStatus, setSuccessStatus] = useState<string | null>(null);

  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await fetch("/api/merchant/settings", { cache: "no-store" });
        const payload = await res.json();
        if (payload.success && payload.data) {
          const { shopName, email, settings } = payload.data;
          setShopName(shopName ?? "");
          setEmail(email ?? "");
          setGoogleEmail(payload.data.googleEmail ?? null);
          
          if (settings) {
            if (typeof settings.return_negotiation_enabled === "boolean") {
              setAutoReturnRequests(settings.return_negotiation_enabled);
            }
            if (Array.isArray(settings.negotiation_offers) && settings.negotiation_offers.length >= 3) {
              setStep1Percentage(settings.negotiation_offers[0].percentage);
              setStep2Percentage(settings.negotiation_offers[1].percentage);
              setStep3Percentage(settings.negotiation_offers[2].percentage);
            }
          }
        }
      } catch (err) {
        setErrorStatus("Could not load settings.");
      } finally {
        setLoading(false);
      }
    }
    void loadSettings();
  }, []);

  async function saveSettings() {
    if (saving) return;
    setSaving(true);
    setErrorStatus(null);
    setSuccessStatus(null);

    try {
      const res = await fetch("/api/merchant/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shopName,
          email,
          settings: {
            return_negotiation_enabled: autoReturnRequests,
            negotiation_offers: [
              { step: 1, type: "partial_refund", percentage: step1Percentage },
              { step: 2, type: "partial_refund", percentage: step2Percentage },
              { step: 3, type: "store_credit", percentage: step3Percentage },
            ],
          },
        }),
      });

      const payload = await res.json();
      if (!res.ok || !payload.success) {
        setErrorStatus(payload.error?.message ?? "Could not save settings.");
        return;
      }
      setSuccessStatus("Settings successfully saved!");
    } catch (err) {
      setErrorStatus("Could not save settings.");
    } finally {
      setSaving(false);
    }
  }

  async function disconnectGoogle() {
    if (!confirm("Are you sure you want to disconnect your Google account? AI fixes will fallback to SES.")) return;
    try {
      const res = await fetch("/api/auth/google", { method: "DELETE" });
      const payload = await res.json();
      if (payload.success) {
        setGoogleEmail(null);
      }
    } catch (err) {
      setErrorStatus("Could not disconnect Google account.");
    }
  }

  async function handleLogout() {
    if (!confirm("Weet je zeker dat je wilt uitloggen?")) return;
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.replace("/");
  }

  if (loading) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        <h1 className="text-2xl font-semibold">Settings</h1>
        <div className="rounded-lg border p-4 text-sm">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle>Merchant Profile</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <label className="grid gap-1 text-sm">
            Merchant details / Shop Name
            <Input value={shopName} onChange={(e) => setShopName(e.target.value)} />
          </label>
          <label className="grid gap-1 text-sm">
            Support Email Address
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Return Configurations</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={autoReturnRequests}
              onChange={(e) => setAutoReturnRequests(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            Auto-negotiate Return Requests
          </label>

          {autoReturnRequests && (
            <div className="mt-2 grid gap-3">
              <label className="grid gap-1 text-sm">
                Step 1: Initial Partial Refund Offer (%)
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={step1Percentage}
                  onChange={(e) => setStep1Percentage(Number(e.target.value))}
                />
              </label>
              <label className="grid gap-1 text-sm">
                Step 2: Second Partial Refund Offer (%)
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={step2Percentage}
                  onChange={(e) => setStep2Percentage(Number(e.target.value))}
                />
              </label>
              <label className="grid gap-1 text-sm">
                Step 3: Store Credit Offer (%)
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={step3Percentage}
                  onChange={(e) => setStep3Percentage(Number(e.target.value))}
                />
              </label>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Email Integratie</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          {googleEmail ? (
            <div className="flex items-center justify-between gap-4 rounded-lg border border-green-100 bg-green-50 p-4 dark:border-green-900/30 dark:bg-green-900/10">
              <div className="grid gap-0.5">
                <p className="text-sm font-medium text-green-800 dark:text-green-400">✅ Verbonden</p>
                <p className="text-xs text-green-700 dark:text-green-500">{googleEmail}</p>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => void disconnectGoogle()} 
                className="border-green-200 hover:bg-green-100 dark:border-green-800 dark:hover:bg-green-900/30 text-green-700 dark:text-green-400"
              >
                Disconnect
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
              <div className="grid gap-0.5">
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">❌ Geen email gekoppeld</p>
                <p className="text-xs text-zinc-500">Koppel je Gmail om antwoorden direct vanuit je eigen adres te sturen.</p>
              </div>
              <Button size="sm" onClick={() => window.location.href = "/api/auth/google"}>
                Connect met Google
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center gap-4">
        <Button onClick={() => void saveSettings()} disabled={saving}>
          {saving ? "Saving..." : "Save Changes"}
        </Button>
        {successStatus && <p className="text-sm text-green-600">{successStatus}</p>}
        {errorStatus && <p className="text-sm text-red-600">{errorStatus}</p>}
      </div>

      <div className="mt-8 border-t pt-6">
        <h2 className="mb-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">Account</h2>
        <p className="mb-4 text-xs text-zinc-500">Log uit van je KeepMySale account op dit apparaat.</p>
        <Button variant="outline" onClick={() => void handleLogout()} className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-900/20">
          Uitloggen
        </Button>
      </div>
    </div>
  );
}
