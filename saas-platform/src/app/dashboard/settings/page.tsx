"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { IMerchantSettings, DEFAULT_MERCHANT_SETTINGS } from "@/types/merchant";

// --- Icons ---
const StoreIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="12" x="2" y="10" rx="2"/><path d="M22 10V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v4"/><path d="M3 10V6c0-1.1.9-2 2-2h14a2 2 0 0 1 2 2v4"/><path d="M12 2v2"/><path d="M12 10v12"/><path d="M12 18h10"/></svg>
);
const UserIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
);
const BotIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg>
);
const ShieldIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.5 3.8 17 5 19 5a1 1 0 0 1 1 1z"/></svg>
);
const ZapIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 14.71 13 3l-1.31 8.82L20 9.29 11 21l1.31-8.82z"/></svg>
);
const ScaleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21h10"/><path d="M12 3v18"/><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/></svg>
);

// --- Sub-components ---
const TabButton = ({ active, label, onClick, icon: Icon }: { active: boolean, label: string, onClick: () => void, icon?: any }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-all rounded-lg ${
      active 
        ? "bg-teal-50 text-teal-700 shadow-sm border border-teal-100" 
        : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50"
    }`}
  >
    {Icon && <Icon />}
    {label}
  </button>
);

const SectionHeader = ({ title, description }: { title: string, description?: string }) => (
  <div className="mb-4">
    <h3 className="text-base font-semibold text-zinc-900">{title}</h3>
    {description && <p className="text-sm text-zinc-500 mt-0.5">{description}</p>}
  </div>
);

const Toggle = ({ checked, onChange, label, description }: { checked: boolean, onChange: (val: boolean) => void, label: string, description?: string }) => (
  <div className="flex items-center justify-between gap-4 py-3">
    <div className="flex-1">
      <p className="text-sm font-medium text-zinc-900">{label}</p>
      {description && <p className="text-xs text-zinc-500">{description}</p>}
    </div>
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`${checked ? 'bg-teal-600' : 'bg-zinc-200'} relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-offset-2`}
    >
      <span className={`${checked ? 'translate-x-5' : 'translate-x-0'} pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`} />
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
      setSuccessStatus("Settings saved successfully ✅");
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
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-8">
        <div className="h-8 w-48 bg-zinc-100 animate-pulse rounded-md" />
        <div className="mt-8 rounded-xl border bg-white p-12 flex justify-center items-center text-zinc-400">
           <svg className="animate-spin h-6 w-6 mr-3 text-teal-500" viewBox="0 0 24 24">
             <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
             <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
           </svg>
           Loading your configuration...
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-8 pb-32 font-sans">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 font-inter">Settings</h1>
          <p className="mt-1 text-zinc-500">Configure your brand voice, automation rules, and return policy.</p>
        </div>
        <div className="flex items-center gap-3">
           <Badge variant="outline" className="bg-zinc-50 text-zinc-600 border-zinc-200 px-3 py-1">
             {subscriptionTier.toUpperCase()} PLAN
           </Badge>
           <span className={`inline-flex h-2.5 w-2.5 rounded-full ${subscriptionStatus === 'active' || subscriptionStatus === 'trial' ? 'bg-green-500' : 'bg-red-500'}`} />
        </div>
      </div>

      {/* --- Navigation Tabs --- */}
      <div className="flex items-center gap-1 bg-zinc-100/50 p-1 rounded-xl w-fit border border-zinc-200/60 sticky top-4 z-40 backdrop-blur-md">
        <TabButton active={activeTab === "general"} label="General" icon={StoreIcon} onClick={() => setActiveTab("general")} />
        <TabButton active={activeTab === "persona"} label="AI Persona" icon={BotIcon} onClick={() => setActiveTab("persona")} />
        <TabButton active={activeTab === "negotiation"} label="Negotiation" icon={ScaleIcon} onClick={() => setActiveTab("negotiation")} />
        <TabButton active={activeTab === "automation"} label="Automation" icon={ZapIcon} onClick={() => setActiveTab("automation")} />
        <TabButton active={activeTab === "rules"} label="Rules" icon={ShieldIcon} onClick={() => setActiveTab("rules")} />
        <TabButton active={activeTab === "account"} label="Account" icon={UserIcon} onClick={() => setActiveTab("account")} />
      </div>

      <div className="mt-2 space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
        
        {/* --- TAB: GENERAL --- */}
        {activeTab === "general" && (
          <Card className="border-zinc-200/80 shadow-sm overflow-hidden">
            <CardHeader className="bg-zinc-50/50 border-b border-zinc-100 px-8 py-6">
              <CardTitle className="text-lg">Store Profile</CardTitle>
              <CardDescription>Basic information and connections for your store.</CardDescription>
            </CardHeader>
            <CardContent className="p-8 space-y-8">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-700">Display Brand Name</label>
                  <Input 
                    value={shopName} 
                    onChange={(e) => handleProfileChange(setShopName, e.target.value)}
                    className="focus-visible:ring-teal-600 bg-zinc-50/30"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-700">Support Email Address</label>
                  <Input 
                    type="email"
                    value={email} 
                    onChange={(e) => handleProfileChange(setEmail, e.target.value)}
                    className="focus-visible:ring-teal-600 bg-zinc-50/30"
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-700">Interface Language</label>
                  <select 
                    value={settings.language}
                    onChange={(e) => updateSetting("language", e.target.value)}
                    className="w-full h-10 px-3 text-sm bg-zinc-50/30 border border-zinc-200 rounded-md focus:ring-2 focus:ring-teal-600 outline-none"
                  >
                    <option value="nl">Dutch (Nederlands)</option>
                    <option value="en">English (US/UK)</option>
                    <option value="pt">Portuguese (Português)</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-700">Display Currency</label>
                  <Input 
                    value={settings.currency_display} 
                    onChange={(e) => updateSetting("currency_display", e.target.value)}
                    placeholder="EUR"
                    maxLength={3}
                    className="focus-visible:ring-teal-600 bg-zinc-50/30 uppercase"
                  />
                </div>
              </div>

              <div className="pt-6 border-t border-zinc-100">
                 <SectionHeader title="Integrations" description="Manage your connections to external platforms." />
                 <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between p-4 rounded-xl border border-zinc-200 bg-white shadow-xs">
                       <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-lg bg-[#95BF47]/10 flex items-center justify-center text-[#95BF47] font-bold">S</div>
                          <div>
                             <p className="text-sm font-semibold">Shopify</p>
                             <p className="text-xs text-zinc-500">{isShopifyConnected ? shopDomain : "Not connected"}</p>
                          </div>
                       </div>
                       {isShopifyConnected ? (
                         <Badge className="bg-green-50 text-green-700 border-green-100 hover:bg-green-50">Active</Badge>
                       ) : (
                         <Button size="sm" variant="outline">Connect</Button>
                       )}
                    </div>

                    <div className="flex items-center justify-between p-4 rounded-xl border border-zinc-200 bg-white shadow-xs">
                       <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-lg bg-[#EA4335]/10 flex items-center justify-center text-[#EA4335] font-bold">G</div>
                          <div>
                             <p className="text-sm font-semibold">Gmail</p>
                             <p className="text-xs text-zinc-500">{googleEmail ?? "Send emails via fallback SES"}</p>
                          </div>
                       </div>
                       {googleEmail ? (
                         <Button size="sm" variant="outline" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => { if(confirm("Disconnect Gmail?")) { /* Logic here */ } }}>Disconnect</Button>
                       ) : (
                         <Button size="sm" variant="secondary" onClick={() => window.location.href = "/api/auth/google"}>Connect</Button>
                       )}
                    </div>
                 </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* --- TAB: AI PERSONA --- */}
        {activeTab === "persona" && (
          <Card className="border-zinc-200/80 shadow-sm overflow-hidden">
            <CardHeader className="bg-zinc-50/50 border-b border-zinc-100 px-8 py-6">
              <CardTitle className="text-lg">AI Response Style</CardTitle>
              <CardDescription>Tailor the way AI communicates with your customers.</CardDescription>
            </CardHeader>
            <CardContent className="p-8 space-y-8">
              <div className="grid md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-700">Tone of Voice</label>
                    <select 
                      value={settings.tone}
                      onChange={(e) => updateSetting("tone", e.target.value)}
                      className="w-full h-10 px-3 text-sm bg-white border border-zinc-200 rounded-md focus:ring-2 focus:ring-teal-600 outline-none"
                    >
                      <option value="professional">Professional & Helpful</option>
                      <option value="friendly">Friendly & Warm</option>
                      <option value="formal">Strictly Formal</option>
                      <option value="casual">Casual & Conversational</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-700">Greeting Style</label>
                    <select 
                      value={settings.greeting_style}
                      onChange={(e) => updateSetting("greeting_style", e.target.value)}
                      className="w-full h-10 px-3 text-sm bg-white border border-zinc-200 rounded-md focus:ring-2 focus:ring-teal-600 outline-none"
                    >
                      <option value="time_based">Time-based (Good Morning/Afternoon)</option>
                      <option value="always_formal">Always Formal (Dear [Name])</option>
                      <option value="always_casual">Always Casual (Hi [Name])</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-700">Sign-off Text</label>
                    <Input 
                      value={settings.sign_off_text} 
                      onChange={(e) => updateSetting("sign_off_text", e.target.value)}
                      placeholder="Met vriendelijke groet,"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-700">Sign-off Name</label>
                    <Input 
                      value={settings.sign_off_name} 
                      onChange={(e) => updateSetting("sign_off_name", e.target.value)}
                      placeholder="Klantenservice Team"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2 pt-4">
                <label className="text-sm font-medium text-zinc-700">Custom Intro Sentence</label>
                <p className="text-xs text-zinc-500 mb-2">Optional fixed sentence that always appears after the greeting.</p>
                <Input 
                  value={settings.custom_intro} 
                  onChange={(e) => updateSetting("custom_intro", e.target.value)}
                  placeholder="Bedankt voor je bericht over je bestelling."
                />
              </div>

              <div className="bg-teal-50/50 p-6 rounded-xl border border-teal-100 mt-6 overflow-hidden relative">
                 <div className="absolute top-0 right-0 p-3 opacity-10"><BotIcon /></div>
                 <h4 className="text-xs font-bold text-teal-800 uppercase tracking-wider mb-3">Live Preview</h4>
                 <div className="bg-white p-4 rounded-lg shadow-xs text-sm border border-teal-100/50 leading-relaxed font-inter">
                   <p className="text-teal-900/40 mb-2 italic">Good afternoon [Customer Name],</p>
                   {settings.custom_intro && <p className="mb-2 text-teal-900">{settings.custom_intro}</p>}
                   <p className="mb-4 text-zinc-400">[AI-generated response based on {settings.tone} tone...]</p>
                   <p className="font-medium text-zinc-900">{settings.sign_off_text}</p>
                   <p className="font-bold text-zinc-900">{settings.sign_off_name || shopName}</p>
                 </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* --- TAB: NEGOTIATION --- */}
        {activeTab === "negotiation" && (
          <Card className="border-zinc-200/80 shadow-sm overflow-hidden">
            <CardHeader className="bg-zinc-50/50 border-b border-zinc-100 px-8 py-6">
              <CardTitle className="text-lg">Return Negotiation Policy</CardTitle>
              <CardDescription>Configure how AI should offer discounts to prevent returns.</CardDescription>
            </CardHeader>
            <CardContent className="p-8 space-y-10">
              
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
                     <div key={step} className="p-4 rounded-xl border border-zinc-100 bg-zinc-50/50 space-y-4">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-bold text-zinc-500 uppercase">Offer Step {step}</span>
                          <Badge className="bg-zinc-200 text-zinc-700 border-none px-2">{stepConfig?.type === 'store_credit' ? 'Credit' : 'Refund'}</Badge>
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
                          <span className="absolute right-3 top-2 text-zinc-400">%</span>
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
                          className="w-full h-8 text-xs bg-white border border-zinc-200 rounded px-2 outline-none"
                        >
                          <option value="partial_refund">Partial Refund</option>
                          <option value="store_credit">Store Credit</option>
                        </select>
                     </div>
                   );
                 })}
              </div>

              <div className="grid md:grid-cols-2 gap-8 pt-6 border-t border-zinc-100">
                <div className="space-y-5">
                   <SectionHeader title="Logic & Limits" />
                   <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <label className="text-sm text-zinc-600">Max Negotiation Steps</label>
                        <select 
                          value={settings.max_steps}
                          onChange={(e) => updateSetting("max_steps", Number(e.target.value))}
                          className="w-16 h-8 text-sm bg-white border border-zinc-200 rounded px-1"
                        >
                          <option value={1}>1</option>
                          <option value={2}>2</option>
                          <option value={3}>3</option>
                        </select>
                      </div>
                      <div className="flex justify-between items-center">
                        <label className="text-sm text-zinc-600">Min Order Value (€)</label>
                        <Input 
                          type="number"
                          className="w-24 h-8 text-sm"
                          value={settings.min_order_value}
                          onChange={(e) => updateSetting("min_order_value", Number(e.target.value))}
                        />
                      </div>
                      <div className="flex justify-between items-center">
                        <label className="text-sm text-zinc-600">Hard Limit Refund %</label>
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
                        <label className="text-xs font-bold text-zinc-400 uppercase">Excluded Keywords</label>
                        <Input 
                          placeholder="Sale, Discount, Outlet..."
                          value={(settings.excluded_keywords || []).join(", ")}
                          onChange={(e) => updateSetting("excluded_keywords", e.target.value.split(",").map(s => s.trim()).filter(Boolean))}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-zinc-400 uppercase">Excluded Categories</label>
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

        {/* --- TAB: AUTOMATION --- */}
        {activeTab === "automation" && (
          <Card className="border-zinc-200/80 shadow-sm overflow-hidden">
            <CardHeader className="bg-zinc-50/50 border-b border-zinc-100 px-8 py-6">
              <CardTitle className="text-lg">Automation Controls</CardTitle>
              <CardDescription>Determine when and how the AI should take action.</CardDescription>
            </CardHeader>
            <CardContent className="p-8 space-y-6">
              
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

              <div className="pt-8 border-t border-zinc-100 grid md:grid-cols-2 gap-12">
                 <div className="space-y-4">
                   <SectionHeader title="Guardrails" />
                   <div className="flex flex-col gap-4">
                      <div className="space-y-2">
                        <div className="flex justify-between">
                           <label className="text-sm font-medium">Confidence Threshold</label>
                           <span className="text-sm font-bold text-teal-600">{Math.round(settings.requires_human_threshold * 100)}%</span>
                        </div>
                        <input 
                          type="range" min="0" max="1" step="0.05"
                          className="w-full h-1.5 bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-teal-600"
                          value={settings.requires_human_threshold}
                          onChange={(e) => updateSetting("requires_human_threshold", Number(e.target.value))}
                        />
                        <p className="text-[10px] text-zinc-400 leading-tight">Escalate to human if AI confidence is below this value.</p>
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
          <Card className="border-zinc-200/80 shadow-sm overflow-hidden">
            <CardHeader className="bg-zinc-50/50 border-b border-zinc-100 px-8 py-6">
              <CardTitle className="text-lg">AI Guardrails & Instructions</CardTitle>
              <CardDescription>Hard rules that the AI must never violate.</CardDescription>
            </CardHeader>
            <CardContent className="p-8 space-y-8">
              <div className="grid md:grid-cols-2 gap-8">
                 <div className="space-y-4">
                   <div className="space-y-2">
                     <label className="text-sm font-medium text-zinc-700">Forbidden Topics</label>
                     <p className="text-xs text-zinc-500">Topics AI should immediately escalate (e.g., Legal, Lawsuit).</p>
                     <textarea 
                       className="w-full min-h-[100px] p-3 text-sm border border-zinc-200 rounded-lg focus:ring-2 focus:ring-teal-600 outline-none"
                       placeholder="Enter comma separated topics..."
                       value={(settings.forbidden_topics || []).join(", ")}
                       onChange={(e) => updateSetting("forbidden_topics", e.target.value.split(",").map(s => s.trim()).filter(Boolean))}
                     />
                   </div>
                   <div className="space-y-2">
                     <label className="text-sm font-medium text-zinc-700">Forbidden Phrases</label>
                     <textarea 
                        className="w-full min-h-[100px] p-3 text-sm border border-zinc-200 rounded-lg focus:ring-2 focus:ring-teal-600 outline-none"
                        placeholder="I cannot help you, We don't care..."
                        value={(settings.forbidden_phrases || []).join(", ")}
                        onChange={(e) => updateSetting("forbidden_phrases", e.target.value.split(",").map(s => s.trim()).filter(Boolean))}
                     />
                   </div>
                 </div>

                 <div className="space-y-4">
                   <div className="space-y-2">
                     <label className="text-sm font-medium text-zinc-700">Required Phrases</label>
                     <p className="text-xs text-zinc-500">Phrases AI must always include (e.g., Free worldwide shipping).</p>
                     <textarea 
                        className="w-full min-h-[100px] p-3 text-sm border border-zinc-200 rounded-lg focus:ring-2 focus:ring-teal-600 outline-none"
                        placeholder="VAT inclusive, 10% next order discount..."
                        value={(settings.required_phrases || []).join(", ")}
                        onChange={(e) => updateSetting("required_phrases", e.target.value.split(",").map(s => s.trim()).filter(Boolean))}
                     />
                   </div>
                   <div className="space-y-2">
                     <label className="text-sm font-medium text-zinc-700">Custom System Rules</label>
                     <p className="text-xs text-zinc-500">Free-text instructions for the AI brain.</p>
                     <textarea 
                        className="w-full min-h-[100px] p-3 text-sm border border-zinc-200 rounded-lg focus:ring-2 focus:ring-teal-600 outline-none font-mono text-xs"
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
           <Card className="border-zinc-200/80 shadow-sm overflow-hidden">
            <CardHeader className="bg-rose-50/50 border-b border-rose-100 px-8 py-6">
              <CardTitle className="text-lg text-rose-900">Account Management</CardTitle>
              <CardDescription className="text-rose-700/70">Manage your subscription and credentials.</CardDescription>
            </CardHeader>
            <CardContent className="p-8 space-y-8">
               <div className="flex justify-between items-center py-4 border-b border-zinc-100">
                  <div>
                    <p className="text-sm font-medium text-zinc-900">Subscription Status</p>
                    <p className="text-xs text-zinc-500">You are currently on the {subscriptionTier} plan.</p>
                  </div>
                  <Button variant="outline" className="text-teal-600 border-teal-200">Manage Billing</Button>
               </div>
               
               <div className="flex justify-between items-center py-4 border-b border-zinc-100">
                  <div>
                    <p className="text-sm font-medium text-zinc-900">Logout</p>
                    <p className="text-xs text-zinc-500">End your current session.</p>
                  </div>
                  <Button variant="outline" onClick={async () => {
                     const supabase = createSupabaseBrowserClient();
                     await supabase.auth.signOut();
                     router.push("/");
                  }}>Sign Out</Button>
               </div>

               <div className="pt-6">
                  <h4 className="text-sm font-bold text-red-600 mb-2 font-inter uppercase tracking-wide">Danger Zone</h4>
                  <div className="p-4 rounded-xl border border-red-100 bg-red-50 flex justify-between items-center gap-4">
                     <div>
                        <p className="text-sm font-semibold text-red-900">Delete Account</p>
                        <p className="text-xs text-red-700/70">Permanently remove all your store data and settings. This cannot be undone.</p>
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
                        Delete Account
                      </Button>
                  </div>
               </div>
            </CardContent>
          </Card>
        )}

      </div>

      {/* STICKY SAVE BAR */}
      <div className={`fixed bottom-0 left-0 right-0 z-50 transform transition-transform duration-500 ease-in-out ${hasUnsavedChanges || successStatus || errorStatus ? 'translate-y-0' : 'translate-y-full'}`}>
        <div className="bg-white/80 backdrop-blur-lg border-t border-zinc-200 shadow-[0_-8px_30px_rgb(0,0,0,0.06)] p-5">
          <div className="mx-auto max-w-5xl flex items-center justify-between px-4">
            <div className="flex-1">
              {successStatus && (
                <div className="flex items-center gap-2 text-sm font-bold text-green-700 animate-in zoom-in duration-300">
                  <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                  {successStatus}
                </div>
              )}
              {errorStatus && (
                <div className="flex items-center gap-2 text-sm font-bold text-red-600 animate-in shake duration-300">
                  <div className="h-2 w-2 rounded-full bg-red-500" />
                  {errorStatus}
                </div>
              )}
              {!successStatus && !errorStatus && hasUnsavedChanges && (
                <div className="flex items-center gap-2 text-sm font-medium text-amber-700">
                   <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                   Pending changes...
                </div>
              )}
            </div>
            <div className="flex gap-4">
              {hasUnsavedChanges && (
                <Button 
                  variant="ghost" 
                  onClick={() => window.location.reload()}
                  disabled={saving}
                  className="text-zinc-500 hover:text-zinc-900"
                >
                  Discard
                </Button>
              )}
              <Button 
                onClick={() => void saveAll()} 
                disabled={!hasUnsavedChanges || saving}
                className="bg-teal-600 hover:bg-teal-700 text-white min-w-[140px] shadow-lg shadow-teal-600/20 rounded-xl h-11"
              >
                {saving ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
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
