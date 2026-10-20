"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader, Skeleton } from "@/components/ui/page";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { IMerchantSettings, DEFAULT_MERCHANT_SETTINGS } from "@/types/merchant";

// --- Icons ---
const StoreIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="12" x="2" y="10" rx="2"/><path d="M22 10V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v4"/><path d="M3 10V6c0-1.1.9-2 2-2h14a2 2 0 0 1 2 2v4"/><path d="M12 2v2"/><path d="M12 10v12"/><path d="M12 18h10"/></svg>
);
const UserIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
);
const BotIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg>
);
const ShieldIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.5 3.8 17 5 19 5a1 1 0 0 1 1 1z"/></svg>
);
const ZapIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M4 14.71 13 3l-1.31 8.82L20 9.29 11 21l1.31-8.82z"/></svg>
);
const ScaleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21h10"/><path d="M12 3v18"/><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/></svg>
);

// --- Sub-components ---
const TabButton = ({ active, label, onClick, icon: Icon }: { active: boolean, label: string, onClick: () => void, icon?: any }) => (
  <button
    role="tab"
    aria-selected={active}
    onClick={onClick}
    className={`kms-press flex shrink-0 items-center gap-2 rounded-[10px] px-3.5 py-2 text-sm font-medium ${
      active
        ? "bg-white text-foreground shadow-card"
        : "text-muted hover:bg-white/60 hover:text-foreground"
    }`}
  >
    {Icon && <span className={active ? "text-kept" : "text-faint"}><Icon /></span>}
    {label}
  </button>
);

const SectionHeader = ({ title, description }: { title: string, description?: string }) => (
  <div className="mb-4">
    <h3 className="kms-section-title">{title}</h3>
    {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
  </div>
);

const Toggle = ({ checked, onChange, label, description }: { checked: boolean, onChange: (val: boolean) => void, label: string, description?: string }) => (
  <div className="flex items-center justify-between gap-4 py-3">
    <div className="flex-1">
      <p className="text-sm font-medium text-foreground">{label}</p>
      {description && <p className="mt-0.5 text-xs text-muted">{description}</p>}
    </div>
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`${checked ? "bg-kept" : "bg-[#d5dbe1]"} relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full p-0.5 transition-colors duration-200 ease-out`}
    >
      <span className={`${checked ? "translate-x-5" : "translate-x-0"} pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-[0_1px_3px_rgb(15_23_42/0.25)] transition-transform duration-200 [transition-timing-function:var(--ease-out)]`} />
    </button>
  </div>
);

// --- Main Page ---
export default function SettingsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab ] = useState("general");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [successStatus, setSuccessStatus] = useState<string | null>(null);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);

  // States
  const [shopName, setShopName] = useState("");
  const [email, setEmail] = useState("");
  const [googleEmail, setGoogleEmail] = useState<string | null>(null);
  const [isShopifyConnected, setIsShopifyConnected] = useState(false);
  const [shopDomain, setShopDomain] = useState("");
  const [subscriptionTier, setSubscriptionTier] = useState("starter");
  const [subscriptionStatus, setSubscriptionStatus] = useState("trial");
  const [exchangeScopesGranted, setExchangeScopesGranted] = useState(false);
  
  // Full Spec Settings
  const [settings, setSettings] = useState<IMerchantSettings>(DEFAULT_MERCHANT_SETTINGS);

  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch("/api/merchant/settings", { cache: "no-store" });
        const payload = await res.json();
        if (payload.success && payload.data) {
          const { shopName, email, googleEmail, isShopifyConnected, shopDomain, subscriptionTier, subscriptionStatus, settings: rawSettings } = payload.data;
          setShopName(shopName ?? "");
          setEmail(email ?? "");
          setGoogleEmail(googleEmail ?? null);
          setIsShopifyConnected(isShopifyConnected ?? false);
          setShopDomain(shopDomain ?? "");
          setSubscriptionTier(subscriptionTier ?? "starter");
          setSubscriptionStatus(subscriptionStatus ?? "trial");
          setExchangeScopesGranted(Boolean(payload.data.exchangeScopesGranted));
          
          if (rawSettings) {
             setSettings({
               ...DEFAULT_MERCHANT_SETTINGS,
               ...rawSettings
             });
          }
        }
      } catch (err) {
        setErrorStatus("Could not load settings.");
      } finally {
        setLoading(false);
      }
    }
    void loadData();
  }, []);

  const updateSetting = (key: keyof IMerchantSettings, value: any) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setHasUnsavedChanges(true);
    setSuccessStatus(null);
  };

  const handleProfileChange = (setter: any, val: any) => {
    setter(val);
    setHasUnsavedChanges(true);
    setSuccessStatus(null);
  };

  async function saveAll() {
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
          settings,
        }),
      });

      const payload = await res.json();
      if (!res.ok || !payload.success) {
        setErrorStatus(payload.error?.message ?? "Failed to save settings");
        return;
      }
      setSuccessStatus("Saved");
      setHasUnsavedChanges(false);
      setTimeout(() => setSuccessStatus(null), 3000);
    } catch (err) {
      setErrorStatus("Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 pb-12" aria-busy="true">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-11 w-full max-w-2xl" />
        <div className="kms-card flex flex-col gap-4 p-8">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 pb-32">
      <PageHeader
        title="Settings"
        description="Your brand voice, return offers, automation rules and account."
        actions={
          <Badge variant={subscriptionStatus === "active" || subscriptionStatus === "trial" ? "teal" : "rose"} dot>
            {subscriptionStatus === "trial" ? "Free trial" : `${subscriptionTier.charAt(0).toUpperCase()}${subscriptionTier.slice(1)} plan`}
          </Badge>
        }
      />

      {/* --- Navigation Tabs --- */}
      <div role="tablist" aria-label="Settings sections" className="kms-no-scrollbar sticky top-14 z-30 -mx-1 flex gap-1 overflow-x-auto rounded-[12px] bg-[#e9edf1]/80 p-1 backdrop-blur-md md:top-3 md:w-fit">
        <TabButton active={activeTab === "general"} label="General" icon={StoreIcon} onClick={() => setActiveTab("general")} />
        <TabButton active={activeTab === "persona"} label="AI persona" icon={BotIcon} onClick={() => setActiveTab("persona")} />
        <TabButton active={activeTab === "negotiation"} label="Negotiation" icon={ScaleIcon} onClick={() => setActiveTab("negotiation")} />
        <TabButton active={activeTab === "automation"} label="Automation" icon={ZapIcon} onClick={() => setActiveTab("automation")} />
        <TabButton active={activeTab === "rules"} label="Rules" icon={ShieldIcon} onClick={() => setActiveTab("rules")} />
        <TabButton active={activeTab === "account"} label="Account" icon={UserIcon} onClick={() => setActiveTab("account")} />
      </div>

      <div key={activeTab} className="kms-enter space-y-6">
        
        {/* --- TAB: GENERAL --- */}
        {activeTab === "general" && (
          <Card className="overflow-hidden !p-0">
            <CardHeader className="!mb-0 border-b border-line px-6 py-5 sm:px-8">
              <CardTitle className="text-base">Store Profile</CardTitle>
              <CardDescription>Basic information and connections for your store.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-8 p-6 sm:p-8">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[13px] font-medium text-foreground">Display Brand Name</label>
                  <Input 
                    value={shopName} 
                    onChange={(e) => handleProfileChange(setShopName, e.target.value)}
                   
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[13px] font-medium text-foreground">Support Email Address</label>
                  <Input 
                    type="email"
                    value={email} 
                    onChange={(e) => handleProfileChange(setEmail, e.target.value)}
                   
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[13px] font-medium text-foreground">Interface Language</label>
                  <select 
                    value={settings.language}
                    onChange={(e) => updateSetting("language", e.target.value)}
                    className="h-10 w-full rounded-[10px] border border-line-strong bg-white px-3 text-sm text-foreground hover:border-faint focus:border-kept focus:shadow-[0_0_0_3px_rgb(13_148_136/0.15)] focus:outline-none"
                  >
                    <option value="nl">Dutch (Nederlands)</option>
                    <option value="en">English (US/UK)</option>
                    <option value="pt">Portuguese (Português)</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[13px] font-medium text-foreground">Display Currency</label>
                  <Input 
                    value={settings.currency_display} 
                    onChange={(e) => updateSetting("currency_display", e.target.value)}
                    placeholder="EUR"
                    maxLength={3}
                    className="uppercase"
                  />
                </div>
              </div>

              <div className="pt-6 border-t border-line">
                 <SectionHeader title="Integrations" description="Manage your connections to external platforms." />
                 <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between gap-4 rounded-[12px] bg-surface-2 p-4 ring-1 ring-inset ring-line">
                       <div className="flex items-center gap-4">
                          <div className="grid h-10 w-10 place-items-center rounded-[10px] bg-[#95BF47]/15 font-bold text-[#5e8e3e]">S</div>
                          <div>
                             <p className="text-sm font-semibold">Shopify</p>
                             <p className="text-xs text-muted">{isShopifyConnected ? shopDomain : "Not connected"}</p>
                          </div>
                       </div>
                       {isShopifyConnected ? (
                         <Badge variant="teal" dot>Connected</Badge>
                       ) : (
                         <Button size="sm" variant="outline" onClick={() => window.open(shopDomain ? `/api/shopify/install?shop=${encodeURIComponent(shopDomain)}` : "/onboarding", "_top")}>Connect</Button>
                       )}
                    </div>

                    <div className="flex items-center justify-between gap-4 rounded-[12px] bg-surface-2 p-4 ring-1 ring-inset ring-line">
                       <div className="flex items-center gap-4">
                          <div className="grid h-10 w-10 place-items-center rounded-[10px] bg-[#EA4335]/10 font-bold text-[#c5221f]">G</div>
                          <div>
                             <p className="text-sm font-semibold">Gmail</p>
                             <p className="text-xs text-muted">{googleEmail ?? "Not connected: replies go out through the email fallback"}</p>
                          </div>
                       </div>
                       {googleEmail ? (
                         <div className="flex gap-2">
                           {/* Google refuses to open inside the Shopify admin frame, so the consent screen opens top-level */}
                           <Button size="sm" variant="outline" onClick={() => window.open("/api/auth/google", "_top")}>Reconnect</Button>
                           <Button size="sm" variant="ghost" className="text-lost hover:!bg-lost-soft" onClick={async () => {
                             if (!confirm("Disconnect Gmail? KeepMySale stops reading and answering this inbox.")) return;
                             const res = await fetch("/api/auth/google", { method: "DELETE" });
                             if (res.ok) setGoogleEmail(null);
                             else setErrorStatus("Could not disconnect Gmail. Try again.");
                           }}>Disconnect</Button>
                         </div>
                       ) : (
                         <Button size="sm" onClick={() => window.open("/api/auth/google", "_top")}>Connect Gmail</Button>
                       )}
                    </div>
                 </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* --- TAB: AI PERSONA --- */}
        {activeTab === "persona" && (
          <Card className="overflow-hidden !p-0">
            <CardHeader className="!mb-0 border-b border-line px-6 py-5 sm:px-8">
              <CardTitle className="text-base">AI Response Style</CardTitle>
              <CardDescription>Tailor the way AI communicates with your customers.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-8 p-6 sm:p-8">
              <div className="grid md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[13px] font-medium text-foreground">Tone of Voice</label>
                    <select 
                      value={settings.tone}
                      onChange={(e) => updateSetting("tone", e.target.value)}
                      className="w-full h-10 px-3 text-sm bg-white border border-line rounded-md focus:ring-2 focus:ring-kept outline-none"
                    >
                      <option value="professional">Professional & Helpful</option>
                      <option value="friendly">Friendly & Warm</option>
                      <option value="formal">Strictly Formal</option>
                      <option value="casual">Casual & Conversational</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[13px] font-medium text-foreground">Greeting Style</label>
                    <select 
                      value={settings.greeting_style}
                      onChange={(e) => updateSetting("greeting_style", e.target.value)}
                      className="w-full h-10 px-3 text-sm bg-white border border-line rounded-md focus:ring-2 focus:ring-kept outline-none"
                    >
                      <option value="time_based">Time-based (Good Morning/Afternoon)</option>
                      <option value="always_formal">Always Formal (Dear [Name])</option>
                      <option value="always_casual">Always Casual (Hi [Name])</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[13px] font-medium text-foreground">Sign-off Text</label>
                    <Input 
                      value={settings.sign_off_text} 
                      onChange={(e) => updateSetting("sign_off_text", e.target.value)}
                      placeholder="Met vriendelijke groet,"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[13px] font-medium text-foreground">Sign-off Name</label>
                    <Input 
                      value={settings.sign_off_name} 
                      onChange={(e) => updateSetting("sign_off_name", e.target.value)}
                      placeholder="Klantenservice Team"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2 pt-4">
                <label className="text-[13px] font-medium text-foreground">Custom Intro Sentence</label>
                <p className="text-xs text-muted mb-2">Optional fixed sentence that always appears after the greeting.</p>
                <Input 
                  value={settings.custom_intro} 
                  onChange={(e) => updateSetting("custom_intro", e.target.value)}
                  placeholder="Bedankt voor je bericht over je bestelling."
                />
              </div>

              <div className="bg-kept-soft/50 p-6 rounded-xl border border-[#bfe7e2] mt-6 overflow-hidden relative">
                 <div className="absolute top-0 right-0 p-3 opacity-10"><BotIcon /></div>
                 <h4 className="text-xs font-bold text-kept-strong uppercase tracking-wider mb-3">Live Preview</h4>
                 <div className="bg-white p-4 rounded-lg shadow-xs text-sm border border-[#bfe7e2]/50 leading-relaxed font-inter">
                   <p className="text-[#134e4a]/40 mb-2 italic">Good afternoon [Customer Name],</p>
                   {settings.custom_intro && <p className="mb-2 text-[#134e4a]">{settings.custom_intro}</p>}
                   <p className="mb-4 text-faint">[AI-generated response based on {settings.tone} tone...]</p>
                   <p className="font-medium text-foreground">{settings.sign_off_text}</p>
                   <p className="font-bold text-foreground">{settings.sign_off_name || shopName}</p>
                 </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* --- TAB: NEGOTIATION --- */}
        {activeTab === "negotiation" && (
          <Card className="overflow-hidden !p-0">
            <CardHeader className="!mb-0 border-b border-line px-6 py-5 sm:px-8">
              <CardTitle className="text-base">Return Negotiation Policy</CardTitle>
              <CardDescription>Configure how AI should offer discounts to prevent returns.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-10 p-6 sm:p-8">
              
              <Toggle 
                label="Automated Negotiation"
                description="When enabled, AI will proactively try to save sales by offering partial refunds or store credit."
                checked={settings.auto_negotiate}
                onChange={(v) => updateSetting("auto_negotiate", v)}
              />

              <div className="grid md:grid-cols-3 gap-6 pt-4">
                 {[1, 2, 3].map((step) => {
                   const stepConfig = settings.negotiation_steps.find(s => s.step === step);
                   return (
                     <div key={step} className="p-4 rounded-xl border border-line bg-surface-2/50 space-y-4">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-bold text-muted uppercase">Offer Step {step}</span>
                          <Badge className="bg-[#e1e6eb] text-[#334155] border-none px-2">{stepConfig?.type === 'store_credit' ? 'Credit' : 'Refund'}</Badge>
                        </div>
                        <div className="relative">
                          <Input 
                            type="number" 
                            className="bg-white pr-8 font-bold"
                            value={stepConfig?.percentage ?? 0}
                            onChange={(e) => {
                              const newSteps = [...settings.negotiation_steps];
                              const idx = newSteps.findIndex(s => s.step === step);
                              if (idx >= 0) {
                                newSteps[idx] = { ...newSteps[idx], percentage: Number(e.target.value) };
                                updateSetting("negotiation_steps", newSteps);
                              }
                            }}
                          />
                          <span className="absolute right-3 top-2 text-faint">%</span>
                        </div>
                        <select 
                          value={stepConfig?.type}
                          onChange={(e) => {
                             const newSteps = [...settings.negotiation_steps];
                             const idx = newSteps.findIndex(s => s.step === step);
                             if (idx >= 0) {
                               newSteps[idx] = { ...newSteps[idx], type: e.target.value as any };
                               updateSetting("negotiation_steps", newSteps);
                             }
                          }}
                          className="w-full h-8 text-xs bg-white border border-line rounded px-2 outline-none"
                        >
                          <option value="partial_refund">Partial Refund</option>
                          <option value="store_credit">Store Credit</option>
                        </select>
                     </div>
                   );
                 })}
              </div>

              <div className="grid md:grid-cols-2 gap-8 pt-6 border-t border-line">
                <div className="space-y-5">
                   <SectionHeader title="Logic & Limits" />
                   <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <label className="text-sm text-muted">Max Negotiation Steps</label>
                        <select 
                          value={settings.max_steps}
                          onChange={(e) => updateSetting("max_steps", Number(e.target.value))}
                          className="w-16 h-8 text-sm bg-white border border-line rounded px-1"
                        >
                          <option value={1}>1</option>
                          <option value={2}>2</option>
                          <option value={3}>3</option>
                        </select>
                      </div>
                      <div className="flex justify-between items-center">
                        <label className="text-sm text-muted">Min Order Value (€)</label>
                        <Input 
                          type="number"
                          className="w-24 h-8 text-sm"
                          value={settings.min_order_value}
                          onChange={(e) => updateSetting("min_order_value", Number(e.target.value))}
                        />
                      </div>
                      <div className="flex justify-between items-center">
                        <label className="text-sm text-muted">Hard Limit Refund %</label>
                        <Input 
                          type="number"
                          className="w-24 h-8 text-sm"
                          value={settings.max_refund_percentage}
                          onChange={(e) => updateSetting("max_refund_percentage", Number(e.target.value))}
                        />
                      </div>
                   </div>
                </div>

                <div className="space-y-5">
                   <SectionHeader title="Exclusion Keywords" description="CSV list of keywords or categories to skip negotiation for." />
                   <div className="space-y-4">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-faint uppercase">Excluded Keywords</label>
                        <Input 
                          placeholder="Sale, Discount, Outlet..."
                          value={(settings.excluded_keywords || []).join(", ")}
                          onChange={(e) => updateSetting("excluded_keywords", e.target.value.split(",").map(s => s.trim()).filter(Boolean))}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-faint uppercase">Excluded Categories</label>
                        <Input 
                          placeholder="Hygienic, Fragile..."
                          value={(settings.excluded_categories || []).join(", ")}
                          onChange={(e) => updateSetting("excluded_categories", e.target.value.split(",").map(s => s.trim()).filter(Boolean))}
                        />
                      </div>
                   </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* --- TAB: NEGOTIATION, exchanges --- */}
        {activeTab === "negotiation" && (
          <Card className="overflow-hidden !p-0">
            <CardHeader className="!mb-0 border-b border-line px-6 py-5 sm:px-8">
              <CardTitle className="text-base">Exchange first</CardTitle>
              <CardDescription>When a customer returns something because of the size, offer a size that is in stock before any discount. An exchange keeps the whole sale.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 p-6 sm:p-8">
              <div role="radiogroup" aria-label="Exchange mode" className="grid gap-3 md:grid-cols-3">
                {([
                  { value: "off", title: "Off", body: "Size returns get your normal return offers." },
                  { value: "suggest", title: "Suggest", body: "KeepMySale offers an in-stock size. Accepted swaps appear under Returns → Exchanges for you to process in Shopify." },
                  { value: "automatic", title: "Automatic", body: "Also creates the return and exchange in Shopify, and Shopify emails the customer the return details." },
                ] as const).map((option) => {
                  const selected = (settings.exchange_mode ?? "suggest") === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => updateSetting("exchange_mode", option.value)}
                      className={`kms-press rounded-[12px] p-4 text-left ring-1 ring-inset transition-colors ${selected ? "bg-kept-soft ring-kept" : "bg-white ring-line hover:ring-line-strong"}`}
                    >
                      <span className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-foreground">{option.title}</span>
                        <span className={`grid h-4 w-4 place-items-center rounded-full ring-1 ring-inset ${selected ? "ring-kept" : "ring-line-strong"}`}>
                          {selected ? <span className="h-2 w-2 rounded-full bg-kept" /> : null}
                        </span>
                      </span>
                      <span className="mt-1.5 block text-xs text-muted">{option.body}</span>
                    </button>
                  );
                })}
              </div>

              {(settings.exchange_mode ?? "suggest") === "automatic" && (
                exchangeScopesGranted ? (
                  <p className="flex items-center gap-2 text-[13px] text-kept-strong">
                    <span className="h-2 w-2 rounded-full bg-kept" /> Shopify permission for returns is granted.
                  </p>
                ) : (
                  <div className="flex flex-col gap-3 rounded-[12px] bg-attention-soft p-4 ring-1 ring-inset ring-[#f7dfb4] sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-[13px] text-[#7c2d12]">
                      Automatic needs one more Shopify permission (manage returns). Until you grant it, KeepMySale works as Suggest.
                    </p>
                    <Button size="sm" className="shrink-0 bg-attention hover:bg-[#92400e]" onClick={() => window.open(`/api/shopify/install?shop=${encodeURIComponent(shopDomain)}&extra=exchanges`, "_top")}>
                      Grant permission
                    </Button>
                  </div>
                )
              )}
            </CardContent>
          </Card>
        )}

        {/* --- TAB: AUTOMATION --- */}
        {activeTab === "automation" && (
          <Card className="overflow-hidden !p-0">
            <CardHeader className="!mb-0 border-b border-line px-6 py-5 sm:px-8">
              <CardTitle className="text-base">Automation Controls</CardTitle>
              <CardDescription>Determine when and how the AI should take action.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 p-6 sm:p-8">
              
              <SectionHeader title="Auto-Reply Scenarios" />
              <div className="grid md:grid-cols-2 gap-x-12 gap-y-2">
                 <Toggle 
                   label="WISMO Inquiries"
                   description="Provide tracking info immediately upon request."
                   checked={settings.auto_reply_wismo}
                   onChange={(v) => updateSetting("auto_reply_wismo", v)}
                 />
                 <Toggle 
                   label="General Questions"
                   description="Reply to FAQs and generic store questions."
                   checked={settings.auto_reply_general}
                   onChange={(v) => updateSetting("auto_reply_general", v)}
                 />
                 <Toggle 
                   label="Complaints"
                   description="Handle customer dissatisfaction automatically (High Risk)."
                   checked={settings.auto_reply_complaint}
                   onChange={(v) => updateSetting("auto_reply_complaint", v)}
                 />
                 <Toggle 
                   label="Proactive Success Checks"
                   description="Ask customers if they are satisfied 48h after delivery."
                   checked={settings.proactive_check_enabled}
                   onChange={(v) => updateSetting("proactive_check_enabled", v)}
                 />
              </div>

              <div className="pt-8 border-t border-line">
                <SectionHeader title="Response Timing" description="Define when the AI is allowed to send emails out to customers." />
                <div className="grid md:grid-cols-2 gap-12 mt-4">
                  
                  {/* Left Column: Response Delay */}
                  <div className="space-y-6">
                    <div className="space-y-4">
                       <label className="text-[13px] font-medium text-foreground block">Respons Vertraging</label>
                       
                       {/* Preset Pills */}
                       <div className="flex flex-wrap gap-2">
                         {[
                           { val: 0, label: "Instant" },
                           { val: 15, label: "15 min" },
                           { val: 30, label: "30 min" },
                           { val: 60, label: "1 uur" },
                           { val: 120, label: "2 uur" },
                           { val: 240, label: "4 uur" },
                           { val: 1440, label: "24 uur" }
                         ].map(preset => (
                           <button
                             key={preset.val}
                             onClick={() => updateSetting("response_delay_minutes", preset.val)}
                             className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors border ${
                               (settings.response_delay_minutes ?? 0) === preset.val
                                 ? "bg-kept text-white border-kept shadow-sm"
                                 : "bg-white text-muted border-line hover:bg-surface-2"
                             }`}
                           >
                             {preset.label}
                           </button>
                         ))}
                       </div>

                       {/* Custom Time */}
                       <div className="pt-2">
                         <p className="text-xs text-muted mb-2">Of kies een aangepaste tijd:</p>
                         <div className="flex items-center gap-2 max-w-[240px]">
                           <input 
                             type="number"
                             min="0"
                             className="w-20 h-9 px-3 text-sm bg-white border border-line rounded-md focus:ring-2 focus:ring-kept outline-none"
                             value={(() => {
                               const val = settings.response_delay_minutes ?? 0;
                               return (val > 0 && val % 60 === 0 && val >= 60 && ![15, 30].includes(val)) ? val / 60 : val;
                             })()}
                             onChange={(e) => {
                               const num = parseInt(e.target.value) || 0;
                               const isHours = (settings.response_delay_minutes ?? 0) >= 60 && (settings.response_delay_minutes ?? 0) % 60 === 0;
                               updateSetting("response_delay_minutes", isHours ? num * 60 : num);
                             }}
                           />
                           <select 
                             className="flex-1 h-9 px-2 text-sm bg-white border border-line rounded-md focus:ring-2 focus:ring-kept outline-none"
                             value={((settings.response_delay_minutes ?? 0) > 0 && (settings.response_delay_minutes ?? 0) % 60 === 0 && (settings.response_delay_minutes ?? 0) >= 60) ? "uren" : "minuten"}
                             onChange={(e) => {
                               const num = settings.response_delay_minutes ?? 0;
                               const currentVal = ((num > 0 && num % 60 === 0 && num >= 60) ? num / 60 : num) || 0;
                               if (e.target.value === "uren") {
                                 updateSetting("response_delay_minutes", currentVal * 60);
                               } else {
                                 updateSetting("response_delay_minutes", currentVal); // treat as minutes explicitly
                               }
                             }}
                           >
                             <option value="minuten">minuten</option>
                             <option value="uren">uren</option>
                           </select>
                         </div>
                       </div>
                       
                       {/* Human Readable Status */}
                       <p className="text-[11px] font-medium text-kept-strong bg-kept-soft px-3 py-2 rounded border border-[#bfe7e2] flex items-center gap-2 w-fit mt-1">
                          ↳ Huidige vertraging: {
                            (settings.response_delay_minutes ?? 0) === 0 ? "Direct" :
                            (settings.response_delay_minutes ?? 0) === 1440 ? "24 uur" :
                            (settings.response_delay_minutes ?? 0) % 60 === 0 ? `${(settings.response_delay_minutes ?? 0) / 60} uur` :
                            (settings.response_delay_minutes ?? 0) > 60 ? `${Math.floor((settings.response_delay_minutes ?? 0) / 60)} uur ${(settings.response_delay_minutes ?? 0) % 60} minuten` :
                            `${settings.response_delay_minutes ?? 0} minuten`
                          }
                       </p>
                    </div>
                  </div>

                  {/* Right Column: Business Hours */}
                  <div className="space-y-6">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <div className="relative flex items-center">
                        <input
                           type="checkbox"
                           className="w-4 h-4 rounded border-line-strong text-kept focus:ring-kept accent-[var(--kept)]"
                           checked={!(settings.business_hours_enabled ?? true)}
                           onChange={(e) => updateSetting("business_hours_enabled", !e.target.checked)}
                        />
                      </div>
                      <span className="text-sm font-medium text-foreground">Reageer 24 uur per dag (geen beperking op tijdstip)</span>
                    </label>

                    <div className={`space-y-4 transition-opacity ${!(settings.business_hours_enabled ?? true) ? "opacity-40 pointer-events-none" : "opacity-100"}`}>
                      <div className="space-y-2">
                        <label className="text-[13px] font-medium text-foreground">Stuur alleen emails tussen:</label>
                        <div className="flex gap-4">
                          <Input 
                            type="time" 
                            value={settings.business_hours_start ?? "09:00"} 
                            onChange={(e) => updateSetting("business_hours_start", e.target.value)}
                            className="bg-white"
                          />
                          <span className="flex items-center text-muted">tot</span>
                          <Input 
                            type="time" 
                            value={settings.business_hours_end ?? "18:00"} 
                            onChange={(e) => updateSetting("business_hours_end", e.target.value)}
                            className="bg-white"
                          />
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <label className="text-[13px] font-medium text-foreground">Tijdzone</label>
                        <select 
                          value={settings.business_hours_timezone ?? "Europe/Amsterdam"}
                          onChange={(e) => updateSetting("business_hours_timezone", e.target.value)}
                          className="w-full h-10 px-3 text-sm bg-white border border-line rounded-md focus:ring-2 focus:ring-kept outline-none"
                        >
                          <option value="Europe/Amsterdam">Berlijn/Amsterdam/Parijs (CET)</option>
                          <option value="Europe/London">Londen (GMT/BST)</option>
                          <option value="America/New_York">New York (EST)</option>
                          <option value="America/Los_Angeles">Los Angeles (PST)</option>
                          <option value="UTC">UTC</option>
                        </select>
                      </div>

                      <div className="pt-2">
                        <Toggle 
                          label="Ook in weekenden reageren"
                          description="Indien uitgevinkt, wachten berichten tot maandag."
                          checked={settings.business_hours_weekends}
                          onChange={(v) => updateSetting("business_hours_weekends", v)}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-8 border-t border-line grid md:grid-cols-2 gap-12">
                 <div className="space-y-4">
                   <SectionHeader title="Guardrails" />
                   <div className="flex flex-col gap-4">
                      <div className="space-y-2">
                        <div className="flex justify-between">
                           <label className="text-sm font-medium">Confidence Threshold</label>
                           <span className="text-sm font-bold text-kept">{Math.round(settings.requires_human_threshold * 100)}%</span>
                        </div>
                        <input 
                          type="range" min="0" max="1" step="0.05"
                          className="w-full h-1.5 bg-[#e1e6eb] rounded-lg appearance-none cursor-pointer accent-[var(--kept)]"
                          value={settings.requires_human_threshold}
                          onChange={(e) => updateSetting("requires_human_threshold", Number(e.target.value))}
                        />
                        <p className="text-[10px] text-faint leading-tight">Escalate to human if AI confidence is below this value.</p>
                      </div>

                      <Toggle 
                        label="Shadow Mode (Review Required)"
                        description="AI will only create DRAFTS. You must approve every reply."
                        checked={settings.shadow_mode}
                        onChange={(v) => updateSetting("shadow_mode", v)}
                      />
                   </div>
                 </div>

                 <div className="space-y-4">
                   <SectionHeader title="Technical Display" />
                   <div className="grid gap-4">
                      <Toggle 
                        label="Include Tracking Link"
                        description="Directly link to carrier website in replies."
                        checked={settings.include_tracking_in_wismo}
                        onChange={(v) => updateSetting("include_tracking_in_wismo", v)}
                      />
                      <Toggle 
                        label="List Line Items"
                        description="Remind customers exactly what they ordered."
                        checked={settings.include_line_items_in_wismo}
                        onChange={(v) => updateSetting("include_line_items_in_wismo", v)}
                      />
                   </div>
                 </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* --- TAB: RULES --- */}
        {activeTab === "rules" && (
          <Card className="overflow-hidden !p-0">
            <CardHeader className="!mb-0 border-b border-line px-6 py-5 sm:px-8">
              <CardTitle className="text-base">AI Guardrails & Instructions</CardTitle>
              <CardDescription>Hard rules that the AI must never violate.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-8 p-6 sm:p-8">
              <div className="grid md:grid-cols-2 gap-8">
                 <div className="space-y-4">
                   <div className="space-y-2">
                     <label className="text-[13px] font-medium text-foreground">Forbidden Topics</label>
                     <p className="text-xs text-muted">Topics AI should immediately escalate (e.g., Legal, Lawsuit).</p>
                     <textarea 
                       className="w-full min-h-[100px] p-3 text-sm border border-line rounded-lg focus:ring-2 focus:ring-kept outline-none"
                       placeholder="Enter comma separated topics..."
                       value={(settings.forbidden_topics || []).join(", ")}
                       onChange={(e) => updateSetting("forbidden_topics", e.target.value.split(",").map(s => s.trim()).filter(Boolean))}
                     />
                   </div>
                   <div className="space-y-2">
                     <label className="text-[13px] font-medium text-foreground">Forbidden Phrases</label>
                     <textarea 
                        className="w-full min-h-[100px] p-3 text-sm border border-line rounded-lg focus:ring-2 focus:ring-kept outline-none"
                        placeholder="I cannot help you, We don't care..."
                        value={(settings.forbidden_phrases || []).join(", ")}
                        onChange={(e) => updateSetting("forbidden_phrases", e.target.value.split(",").map(s => s.trim()).filter(Boolean))}
                     />
                   </div>
                 </div>

                 <div className="space-y-4">
                   <div className="space-y-2">
                     <label className="text-[13px] font-medium text-foreground">Required Phrases</label>
                     <p className="text-xs text-muted">Phrases AI must always include (e.g., Free worldwide shipping).</p>
                     <textarea 
                        className="w-full min-h-[100px] p-3 text-sm border border-line rounded-lg focus:ring-2 focus:ring-kept outline-none"
                        placeholder="VAT inclusive, 10% next order discount..."
                        value={(settings.required_phrases || []).join(", ")}
                        onChange={(e) => updateSetting("required_phrases", e.target.value.split(",").map(s => s.trim()).filter(Boolean))}
                     />
                   </div>
                   <div className="space-y-2">
                     <label className="text-[13px] font-medium text-foreground">Custom System Rules</label>
                     <p className="text-xs text-muted">Free-text instructions for the AI brain.</p>
                     <textarea 
                        className="w-full min-h-[100px] p-3 text-sm border border-line rounded-lg focus:ring-2 focus:ring-kept outline-none font-mono text-xs"
                        placeholder="Always mention that return shipping is handled by the customer..."
                        value={(settings.custom_rules || []).join("\n")}
                        onChange={(e) => updateSetting("custom_rules", e.target.value.split("\n").map(s => s.trim()).filter(Boolean))}
                     />
                   </div>
                 </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* --- TAB: ACCOUNT --- */}
        {activeTab === "account" && (
           <Card className="overflow-hidden !p-0">
            <CardHeader className="!mb-0 border-b border-line px-6 py-5 sm:px-8">
              <CardTitle className="text-base">Account</CardTitle>
              <CardDescription>Your plan, your session, and deleting your data.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-8 p-6 sm:p-8">
               <div className="flex justify-between items-center py-4 border-b border-line">
                  <div>
                    <p className="text-sm font-medium text-foreground">Plan</p>
                    <p className="text-xs text-muted">You are on the {subscriptionTier} plan. Nothing is charged while KeepMySale is in its pilot.</p>
                  </div>
                  <Badge variant="teal">Free during the pilot</Badge>
               </div>
               
               <div className="flex justify-between items-center py-4 border-b border-line">
                  <div>
                    <p className="text-sm font-medium text-foreground">Sign out</p>
                    <p className="text-xs text-muted">End your current session.</p>
                  </div>
                  <Button variant="outline" onClick={async () => {
                     const supabase = createSupabaseBrowserClient();
                     await supabase.auth.signOut();
                     router.push("/");
                  }}>Sign out</Button>
               </div>

               <div className="pt-6">
                  
                  <div className="flex flex-col justify-between gap-4 rounded-[12px] bg-lost-soft p-4 ring-1 ring-inset ring-[#fbcdd6] sm:flex-row sm:items-center">
                     <div>
                        <p className="text-sm font-semibold text-[#881337]">Delete account and data</p>
                        <p className="text-xs text-[#9f1239]">Removes your store, conversations, orders and settings from KeepMySale. This cannot be undone.</p>
                     </div>
                     <Button 
                        variant="destructive" 
                        size="sm" 
                        onClick={async () => {
                          const confirm = window.prompt("To confirm deletion, please type 'DELETE' in the box below:");
                          if (confirm === "DELETE") {
                            try {
                              const res = await fetch("/api/merchant/account/delete", {
                                method: "POST",
                                body: JSON.stringify({ confirmation: "DELETE" }),
                              });
                              if (res.ok) {
                                const supabase = createSupabaseBrowserClient();
                                await supabase.auth.signOut();
                                window.location.href = "/";
                              } else {
                                alert("Deletion failed. Please contact support.");
                              }
                            } catch (err) {
                              alert("An error occurred during deletion.");
                            }
                          }
                        }}
                      >
                        Delete account
                      </Button>
                  </div>
               </div>
            </CardContent>
          </Card>
        )}

      </div>

      {/* SAVE BAR: rises when there is something to save, and confirms the save */}
      <div
        className={`fixed inset-x-0 bottom-4 z-50 flex justify-center px-4 transition-[transform,opacity] duration-300 [transition-timing-function:var(--ease-out)] ${
          hasUnsavedChanges || successStatus || errorStatus ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-6 opacity-0"
        }`}
        role="status"
        aria-live="polite"
      >
        <div className="flex w-full max-w-xl items-center justify-between gap-4 rounded-[14px] bg-ink px-4 py-3 text-white shadow-raised">
          <div className="min-w-0 text-sm">
            {successStatus && (
              <span className="flex items-center gap-2 font-medium text-kept-glow">
                <span className="h-2 w-2 rounded-full bg-kept-glow" /> {successStatus}
              </span>
            )}
            {errorStatus && (
              <span className="flex items-center gap-2 font-medium text-[#fda4af]">
                <span className="h-2 w-2 rounded-full bg-[#fda4af]" /> {errorStatus}
              </span>
            )}
            {!successStatus && !errorStatus && hasUnsavedChanges && (
              <span className="flex items-center gap-2 text-slate-300">
                <span className="h-2 w-2 rounded-full bg-[#fbbf24]" /> Unsaved changes
              </span>
            )}
          </div>
          <div className="flex shrink-0 gap-2">
            {hasUnsavedChanges && (
              <Button variant="ghost" size="sm" onClick={() => window.location.reload()} disabled={saving} className="!text-slate-300 hover:!bg-white/10">
                Discard
              </Button>
            )}
            <Button size="sm" onClick={() => void saveAll()} disabled={!hasUnsavedChanges} loading={saving} className="bg-kept-glow !text-ink hover:bg-[#99f6e4]">
              {saving ? "Saving" : "Save changes"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
