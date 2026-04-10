"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function SettingsPage() {
  const router = useRouter();
  
  // States
  const [shopName, setShopName] = useState("");
  const [email, setEmail] = useState("");
  const [language, setLanguage] = useState("en");
  const [autoReturnRequests, setAutoReturnRequests] = useState(true);
  const [step1Percentage, setStep1Percentage] = useState(20);
  const [step2Percentage, setStep2Percentage] = useState(35);
  const [step3Percentage, setStep3Percentage] = useState(50);
  const [googleEmail, setGoogleEmail] = useState<string | null>(null);
  const [isShopifyConnected, setIsShopifyConnected] = useState(false);
  const [shopDomain, setShopDomain] = useState("");
  const [subscriptionTier, setSubscriptionTier] = useState("starter");
  const [subscriptionStatus, setSubscriptionStatus] = useState("trial");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);
  const [successStatus, setSuccessStatus] = useState<string | null>(null);
  
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Mark form as dirty when any value changes (primitive way without ref for this simple page)
  const handleInputChange = (setter: any, val: any) => {
    setter(val);
    setHasUnsavedChanges(true);
    setSuccessStatus(null);
  };

  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await fetch("/api/merchant/settings", { cache: "no-store" });
        const payload = await res.json();
        if (payload.success && payload.data) {
          const { shopName, email, googleEmail, isShopifyConnected, shopDomain, subscriptionTier, subscriptionStatus, settings } = payload.data;
          setShopName(shopName ?? "");
          setEmail(email ?? "");
          setGoogleEmail(googleEmail ?? null);
          setIsShopifyConnected(isShopifyConnected ?? false);
          setShopDomain(shopDomain ?? "");
          setSubscriptionTier(subscriptionTier ?? "starter");
          setSubscriptionStatus(subscriptionStatus ?? "trial");
          
          if (settings) {
            if (typeof settings.return_negotiation_enabled === "boolean") {
              setAutoReturnRequests(settings.return_negotiation_enabled);
            }
            if (settings.language) {
              setLanguage(settings.language);
            }
            if (Array.isArray(settings.negotiation_offers) && settings.negotiation_offers.length >= 3) {
              setStep1Percentage(settings.negotiation_offers[0].percentage || 20);
              setStep2Percentage(settings.negotiation_offers[1].percentage || 35);
              setStep3Percentage(settings.negotiation_offers[2].percentage || 50);
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
    if (saving || !hasUnsavedChanges) return;
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
            language,
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
        setErrorStatus(payload.error?.message ?? "Failed to save settings");
        return;
      }
      setSuccessStatus("Settings saved successfully ✅");
      setHasUnsavedChanges(false);
      
      setTimeout(() => {
        setSuccessStatus(null);
      }, 3000);
    } catch (err) {
      setErrorStatus("Failed to save settings");
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
    if (!confirm("Are you sure you want to log out?")) return;
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.replace("/");
  }

  const handleDeleteAccount = () => {
    if (confirm("Are you absolutely sure you want to delete your account? This action cannot be undone.")) {
      alert("Please contact support to delete your account.");
    }
  }

  if (loading) {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 p-6">
        <h1 className="text-3xl font-semibold tracking-tight text-[#1a1a1a]">Settings</h1>
        <p className="text-zinc-500">Manage your store configuration</p>
        <div className="mt-6 rounded-xl border bg-white p-6 shadow-sm">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-6 pb-32 font-sans">
      <div className="mb-2">
        <h1 className="text-3xl font-semibold tracking-tight text-[#1a1a1a]">Settings</h1>
        <p className="mt-2 text-zinc-500">Manage your store configuration</p>
      </div>

      {/* SECTION 1: Store Profile */}
      <section className="rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-zinc-100 bg-zinc-50/50 p-4 px-6">
          <h2 className="flex items-center gap-3 text-lg font-semibold text-zinc-900">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-xl">🏪</span>
            Store Profile
          </h2>
        </div>
        <div className="p-6 grid gap-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <label className="grid gap-2 text-sm font-medium text-zinc-700">
              Shop Name
              <Input 
                className="h-10 border-zinc-300 rounded-lg placeholder:text-zinc-400 focus-visible:ring-teal-600"
                value={shopName} 
                onChange={(e) => handleInputChange(setShopName, e.target.value)} 
                placeholder="Your Shop Name"
              />
            </label>
            <label className="grid gap-2 text-sm font-medium text-zinc-700">
              Support Email
              <Input 
                type="email" 
                className="h-10 border-zinc-300 rounded-lg placeholder:text-zinc-400 focus-visible:ring-teal-600"
                value={email} 
                onChange={(e) => handleInputChange(setEmail, e.target.value)} 
                placeholder="support@store.com"
              />
            </label>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-2">
              Language <span className="ml-1 text-xs font-normal text-zinc-500">Nederlands / English / Português</span>
            </label>
            <div className="relative w-full md:w-1/2">
              <select 
                value={language}
                onChange={(e) => handleInputChange(setLanguage, e.target.value)}
                className="w-full h-10 px-3 pl-3 pr-10 text-sm bg-white border border-zinc-300 rounded-lg appearance-none focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-transparent"
              >
                <option value="nl">Dutch (NL)</option>
                <option value="en">English (EN)</option>
                <option value="pt">Portuguese (PT)</option>
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none text-zinc-500 text-xs">
                ▼
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-zinc-100">
            <h3 className="text-sm font-medium text-zinc-700 mb-3">Shopify Connection</h3>
            {isShopifyConnected ? (
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <span className="inline-flex max-w-fit items-center gap-1.5 rounded-full bg-green-50 px-3 py-1 text-sm font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-500"></span>
                  Connected
                </span>
                <span className="text-sm text-zinc-600 font-medium">{shopDomain}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="inline-flex max-w-fit items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1 text-sm font-medium text-zinc-600 ring-1 ring-inset ring-zinc-500/20">
                  Not connected
                </span>
              </div>
            )}
            <p className="text-xs text-zinc-400 mt-2">
              {isShopifyConnected ? "Last synced recently" : "Connect via your Shopify admin"}
            </p>
          </div>
        </div>
      </section>

      {/* SECTION 2: Return Negotiation */}
      <section className="rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-zinc-100 bg-zinc-50/50 p-4 px-6 flex justify-between items-center flex-wrap gap-4">
          <h2 className="flex items-center gap-3 text-lg font-semibold text-zinc-900">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-50 text-xl">🛡️</span>
            Return Negotiation
          </h2>
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-zinc-600">Auto-negotiate Return Requests</span>
            <button 
              type="button"
              role="switch"
              aria-checked={autoReturnRequests}
              onClick={() => handleInputChange(setAutoReturnRequests, !autoReturnRequests)}
              className={`${autoReturnRequests ? 'bg-teal-600' : 'bg-zinc-200'} relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-offset-2`}
            >
              <span className={`${autoReturnRequests ? 'translate-x-5' : 'translate-x-0'} pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`} />
            </button>
          </div>
        </div>
        
        <div className={`p-6 transition-opacity duration-300 ${autoReturnRequests ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
          <p className="text-sm text-zinc-500 mb-6">
            When enabled, AI automatically offers partial refunds to prevent returns, maximizing your saved revenue.
          </p>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-zinc-50 rounded-xl p-5 border border-zinc-100">
              <h3 className="text-sm font-semibold text-zinc-900 mb-4">Negotiation Steps</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm font-medium text-zinc-600 w-16">Step 1</span>
                  <div className="relative flex-1 max-w-[100px]">
                    <Input
                      type="number"
                      min={0} max={100}
                      value={step1Percentage}
                      onChange={(e) => handleInputChange(setStep1Percentage, Number(e.target.value))}
                      className="pr-8 text-center"
                    />
                    <span className="absolute inset-y-0 right-3 flex items-center text-sm text-zinc-500 pointer-events-none">%</span>
                  </div>
                  <span className="text-sm text-zinc-500 flex-1">Partial Refund</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm font-medium text-zinc-600 w-16">Step 2</span>
                  <div className="relative flex-1 max-w-[100px]">
                    <Input
                      type="number"
                      min={0} max={100}
                      value={step2Percentage}
                      onChange={(e) => handleInputChange(setStep2Percentage, Number(e.target.value))}
                      className="pr-8 text-center"
                    />
                    <span className="absolute inset-y-0 right-3 flex items-center text-sm text-zinc-500 pointer-events-none">%</span>
                  </div>
                  <span className="text-sm text-zinc-500 flex-1">Partial Refund</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm font-medium text-zinc-600 w-16">Step 3</span>
                  <div className="relative flex-1 max-w-[100px]">
                    <Input
                      type="number"
                      min={0} max={100}
                      value={step3Percentage}
                      onChange={(e) => handleInputChange(setStep3Percentage, Number(e.target.value))}
                      className="pr-8 text-center"
                    />
                    <span className="absolute inset-y-0 right-3 flex items-center text-sm text-zinc-500 pointer-events-none">%</span>
                  </div>
                  <span className="text-sm text-zinc-500 flex-1">Store Credit</span>
                </div>
              </div>
            </div>

            <div className="bg-teal-50/50 rounded-xl p-5 border border-teal-100">
              <h3 className="text-sm font-semibold text-teal-900 mb-4">Live Preview</h3>
              <p className="text-sm text-teal-800 mb-4">On a <strong className="font-semibold text-teal-900">€100</strong> order return request:</p>
              
              <div className="space-y-3 relative before:absolute before:inset-y-2 before:left-[11px] before:w-0.5 before:bg-teal-200">
                <div className="flex items-center gap-4 relative">
                  <div className="h-6 w-6 rounded-full bg-teal-100 border-2 border-teal-500 flex items-center justify-center z-10">
                    <span className="text-[10px] font-bold text-teal-700">1</span>
                  </div>
                  <div className="flex-1 bg-white rounded-lg p-2.5 border border-teal-100 shadow-sm">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-zinc-600">Initial Offer</span>
                      <strong className="text-teal-700">€{step1Percentage}</strong>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4 relative">
                  <div className="h-6 w-6 rounded-full bg-teal-100 border-2 border-teal-500 flex items-center justify-center z-10">
                    <span className="text-[10px] font-bold text-teal-700">2</span>
                  </div>
                   <div className="flex-1 bg-white rounded-lg p-2.5 border border-teal-100 shadow-sm">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-zinc-600">Second Offer</span>
                      <strong className="text-teal-700">€{step2Percentage}</strong>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4 relative">
                  <div className="h-6 w-6 rounded-full bg-teal-100 border-2 border-teal-500 flex items-center justify-center z-10">
                    <span className="text-[10px] font-bold text-teal-700">3</span>
                  </div>
                   <div className="flex-1 bg-white rounded-lg p-2.5 border border-teal-100 shadow-sm">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-zinc-600">Store Credit</span>
                      <strong className="text-teal-700">€{step3Percentage}</strong>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-5 pt-4 border-t border-teal-200/50">
                <p className="text-sm font-medium text-teal-900 text-center">
                  Max savings if accepted at step 1: <span className="text-lg ml-1 font-bold">€{100 - step1Percentage}</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 3: Email Integration */}
      <section className="rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-zinc-100 bg-zinc-50/50 p-4 px-6">
           <h2 className="flex items-center gap-3 text-lg font-semibold text-zinc-900">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-50 text-xl">📧</span>
            Email Integration
          </h2>
        </div>
        <div className="p-6">
          {googleEmail ? (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-xl border border-green-100 bg-[#f8fdf9] p-5">
              <div className="grid gap-1">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-green-500"></span>
                  <p className="text-sm font-semibold text-green-900">Connected</p>
                </div>
                <p className="text-base font-medium text-green-950 mt-1">{googleEmail}</p>
                <p className="text-sm text-green-700/80 mt-1">Replies are sent automatically from your Gmail address.</p>
              </div>
              <Button 
                variant="outline" 
                onClick={() => void disconnectGoogle()} 
                className="w-full sm:w-auto border-green-200 hover:bg-green-50/50 text-green-700 bg-white"
              >
                Disconnect
              </Button>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-xl border border-zinc-200 bg-zinc-50 p-5">
              <div className="grid gap-1 max-w-lg">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-zinc-400"></span>
                  <p className="text-sm font-semibold text-zinc-900">Not connected</p>
                </div>
                <p className="text-sm text-zinc-500 mt-2">
                  Connect your Gmail to send AI-generated email replies directly from your own email address. Otherwise, a default SES fallback address is used.
                </p>
              </div>
              <Button 
                onClick={() => window.location.href = "/api/auth/google"}
                className="w-full sm:w-auto bg-zinc-900 hover:bg-zinc-800 text-white"
              >
                Connect with Google
              </Button>
            </div>
          )}
        </div>
      </section>

      {/* SECTION 4: Subscription */}
      <section className="rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-zinc-100 bg-zinc-50/50 p-4 px-6">
           <h2 className="flex items-center gap-3 text-lg font-semibold text-zinc-900">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-50 text-xl">💳</span>
            Subscription
          </h2>
        </div>
        <div className="p-6 grid gap-6 md:grid-cols-[1fr_auto] items-center">
          <div>
            <div className="flex items-center gap-3 mb-4">
               <h3 className="font-semibold text-zinc-900">Current Plan:</h3>
               <span className="inline-flex items-center rounded-full bg-purple-50 px-2.5 py-0.5 text-xs font-semibold text-purple-700 ring-1 ring-inset ring-purple-600/20 capitalize">
                  {subscriptionTier} ({subscriptionStatus})
               </span>
            </div>
            
            <div className="max-w-md">
              <div className="flex justify-between items-end mb-2">
                <span className="text-sm font-medium text-zinc-600">Conversations used</span>
                <span className="text-sm font-semibold text-zinc-900">7 / 100</span>
              </div>
              <div className="h-2.5 w-full bg-zinc-100 rounded-full overflow-hidden">
                <div className="h-full bg-purple-600 rounded-full w-[7%] transition-all duration-500"></div>
              </div>
              <p className="text-xs text-zinc-400 mt-2 text-right">7% consumed</p>
            </div>
          </div>
          <div className="flex w-full md:w-auto">
            <Button className="w-full bg-zinc-900 hover:bg-zinc-800 text-white shadow-sm">
              Upgrade Plan
            </Button>
          </div>
        </div>
      </section>

      {/* SECTION 5: Account */}
      <section className="rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-zinc-100 bg-zinc-50/50 p-4 px-6">
           <h2 className="flex items-center gap-3 text-lg font-semibold text-zinc-900">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xl">👤</span>
            Account
          </h2>
        </div>
        <div className="p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div>
            <p className="text-sm text-zinc-500 font-medium">Signed in as</p>
            <p className="text-base font-medium text-zinc-900 mt-1">{email}</p>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
            <Button 
              variant="outline" 
              onClick={() => void handleLogout()} 
              className="w-full sm:w-auto border-zinc-200 text-zinc-700"
            >
              Log Out
            </Button>
            <Button 
              variant="outline" 
              onClick={handleDeleteAccount} 
              className="w-full sm:w-auto border-red-100 text-red-600 hover:bg-red-50 hover:text-red-700"
            >
              Delete Account
            </Button>
          </div>
        </div>
      </section>

      {/* STICKY SAVE BAR */}
      <div className={`fixed bottom-0 left-0 right-0 z-50 transform transition-transform duration-300 ease-in-out ${hasUnsavedChanges || successStatus || errorStatus ? 'translate-y-0' : 'translate-y-full'}`}>
        <div className="bg-white border-t border-zinc-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] p-4">
          <div className="mx-auto max-w-4xl flex items-center justify-between px-2">
            <div className="flex-1">
              {successStatus && <span className="flex items-center gap-2 text-sm font-medium text-green-700"><span className="h-2 w-2 rounded-full bg-green-500"></span> {successStatus}</span>}
              {errorStatus && <span className="flex items-center gap-2 text-sm font-medium text-red-600"><span className="h-2 w-2 rounded-full bg-red-500"></span> {errorStatus}</span>}
              {!successStatus && !errorStatus && hasUnsavedChanges && <span className="text-sm font-medium text-amber-600">You have unsaved changes.</span>}
            </div>
            <div className="flex gap-3">
              {hasUnsavedChanges && (
                <Button 
                  variant="outline" 
                  onClick={() => window.location.reload()}
                  disabled={saving}
                >
                  Discard
                </Button>
              )}
              <Button 
                onClick={() => void saveSettings()} 
                disabled={!hasUnsavedChanges || saving}
                className="bg-teal-600 hover:bg-teal-700 text-white min-w-[120px]"
              >
                {saving ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Saving...
                  </span>
                ) : "Save Changes"}
              </Button>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
