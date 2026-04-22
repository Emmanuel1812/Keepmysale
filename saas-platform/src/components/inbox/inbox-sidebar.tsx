"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";

// --- [ICONS] ---
const SearchIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>);
const BotIconSmall = () => (<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="14" x="3" y="6" rx="2" ry="2"/><path d="M12 2v4"/><path d="M8 12h.01"/><path d="M16 12h.01"/><path d="M12 16c-2 0-3-1-3-1"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg>);
const SparklesIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/></svg>);

interface ApiConversation {
  id: string;
  status: string;
  subject: string | null;
  intent: string | null;
  category?: string | null;
  isKnownCustomer?: boolean;
  aiResolved: boolean;
  lastMessageAt: string;
  lastMessageSenderType: string | null;
  lastMessageContent: string | null;
  customer?: { name?: string | null; email?: string | null };
}

type TTab = "All" | "Customers" | "Returns" | "Shipping" | "Products" | "Drafts" | "Human Required" | "Spam";
const TABS: TTab[] = ["All", "Customers", "Returns", "Shipping", "Products", "Drafts", "Human Required", "Spam"];

function formatRelativeTime(dateString: string) {
  if (!dateString) return "";
  const date = new Date(dateString);
  const now = new Date();
  const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / 60000);
  
  if (diffInMinutes < 1) return "Just now";
  if (diffInMinutes < 60) return `${diffInMinutes}m`;
  if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h`;
  if (diffInMinutes < 2880) return "Yesterday";
  return date.toLocaleDateString();
}

function IntentBadge({ intent }: { intent: string | null }) {
  if (!intent) return null;
  const normalized = intent.toLowerCase();
  
  let colorClass = "bg-zinc-100 text-zinc-600 border border-zinc-200"; // default general
  
  if (normalized === "wismo") colorClass = "bg-blue-50 text-blue-700 border border-blue-200";
  else if (normalized === "return" || normalized === "exchange") colorClass = "bg-orange-50 text-orange-700 border border-orange-200";
  else if (normalized === "complaint") colorClass = "bg-red-50 text-red-700 border border-red-200";
  else if (normalized === "faq") colorClass = "bg-indigo-50 text-indigo-700 border border-indigo-200";

  return (
    <span className={`text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-md ${colorClass} flex items-center gap-1 w-fit`}>
      🏷️ {intent}
    </span>
  );
}

export function InboxSidebar() {
  const params = useParams<{ id: string }>();
  const activeId = params?.id;
  const [conversations, setConversations] = useState<ApiConversation[]>([]);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<TTab>("All");
  const [showResolved, setShowResolved] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const loadConversations = useCallback(async () => {
    try {
      const response = await fetch("/api/inbox/conversations", { cache: "no-store" });
      const payload = await response.json();
      if (payload.success) setConversations(payload.data?.conversations ?? []);
    } catch {}
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/inbox/sync", { method: "POST" });
      const payload = await res.json();
      if (payload.success) {
        await loadConversations();
      }
    } catch (err) {
      console.error("Sync failed", err);
    } finally {
      setSyncing(false);
    }
  };

  const handleResolveAI = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (resolvingId) return;
    
    setResolvingId(id);
    try {
      const res = await fetch(`/api/inbox/conversations/${id}/resolve-ai`, { method: "POST" });
      const payload = await res.json();
      if (payload.success) {
        await loadConversations();
      } else {
        alert("AI resolution failed: " + (payload.message || "Unknown error"));
      }
    } catch (err) {
      console.error("Manual AI resolve failed", err);
    } finally {
      setResolvingId(null);
    }
  };

  useEffect(() => {
    void loadConversations();
    const interval = setInterval(() => void loadConversations(), 8000);
    return () => clearInterval(interval);
  }, [loadConversations]);

  const filtered = conversations.filter((c) => {
    const isResolved = c.status === "resolved" || c.status === "closed";
    if (isResolved && !showResolved) return false;
    
    const cat = c.category || null;

    if (activeTab === "Customers") {
      if (!c.isKnownCustomer) return false;
      if (["spam", "financial"].includes(cat as any)) return false;
    } else if (activeTab === "Returns") {
      if (!(["returns", "negotiation_active", "negotiation_accepted", "negotiation_rejected"] as (string | null)[]).includes(cat)) return false;
    } else if (activeTab === "Shipping") {
      if (cat !== "shipping") return false;
    } else if (activeTab === "Products") {
      if (cat !== "product") return false;
    } else if (activeTab === "Drafts") {
      if (c.lastMessageSenderType !== "ai_draft") return false;
    } else if (activeTab === "Human Required") {
      if (cat !== "human_required") return false;
    } else if (activeTab === "Spam") {
      if (!(["spam", "financial", "unknown"] as (string | null)[]).includes(cat)) return false;
    }
    
    if (search) {
      const s = search.toLowerCase();
      if (
        !c.subject?.toLowerCase().includes(s) &&
        !c.customer?.name?.toLowerCase().includes(s) &&
        !c.customer?.email?.toLowerCase().includes(s) &&
        !c.id.toLowerCase().includes(s)
      ) {
        return false;
      }
    }
    return true;
  });

  const getUnreadCount = (tab: TTab) => {
    return conversations.filter(c => {
      const isR = c.status === "resolved" || c.status === "closed";
      if (isR) return false;
      
      const unread = c.lastMessageSenderType === "customer";
      if (!unread && tab !== "Drafts") return false;
      if (tab === "Drafts") return c.lastMessageSenderType === "ai_draft";
      
      const cat = c.category || null;
      if (tab === "All") return true;
      if (tab === "Customers") {
        return c.isKnownCustomer === true && !["spam", "financial"].includes(cat as any);
      }
      if (tab === "Returns") return (["returns", "negotiation_active", "negotiation_accepted", "negotiation_rejected"] as (string | null)[]).includes(cat);
      if (tab === "Shipping") return cat === "shipping";
      if (tab === "Products") return cat === "product";
      if (tab === "Human Required") return cat === "human_required";
      if (tab === "Spam") return (["spam", "financial", "unknown"] as (string | null)[]).includes(cat);
      return false;
    }).length;
  };

  const totalActionable = getUnreadCount("All");

  return (
    <div className="flex w-full flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-zinc-200 bg-white">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-[#111827]">Inbox</h2>
            {totalActionable > 0 && (
              <span className="bg-red-100 text-red-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                {totalActionable}
              </span>
            )}
          </div>
          
          <button 
            onClick={handleSync}
            disabled={syncing}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${
              syncing 
                ? "bg-zinc-50 text-zinc-400 border-zinc-200 cursor-not-allowed" 
                : "bg-teal-50 text-teal-700 border-teal-100 hover:bg-teal-100 hover:border-teal-200 shadow-sm"
            }`}
          >
            <svg 
              className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} 
              xmlns="http://www.w3.org/2000/svg" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="3" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            >
              <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.85.83 6.72 2.24" />
              <path d="M21 3v9h-9" />
            </svg>
            {syncing ? "Syncing..." : "Sync"}
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400">
            <SearchIcon />
          </div>
          <input
            type="text"
            className="block w-full pl-9 pr-3 py-1.5 text-sm rounded-lg border border-zinc-200 bg-[#f8fafb] focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all placeholder:text-zinc-400"
            placeholder="Search conversations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        
        {/* Toggle Resolved */}
        <div className="flex items-center gap-2 mb-3 px-1">
          <input
            type="checkbox"
            id="showResolved"
            checked={showResolved}
            onChange={(e) => setShowResolved(e.target.checked)}
            className="rounded border-zinc-300 text-[#111827] focus:ring-[#111827]"
          />
          <label htmlFor="showResolved" className="text-xs font-medium text-zinc-600 cursor-pointer select-none">
            Show resolved conversations
          </label>
        </div>
        
        {/* Unified Tab Row */}
        <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide -mx-1 px-1">
          {TABS.map((tab) => {
            const count = getUnreadCount(tab);
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`whitespace-nowrap px-3 py-1 text-xs font-semibold rounded-full transition-colors flex items-center gap-1.5 ${
                  activeTab === tab 
                    ? "bg-[#111827] text-white" 
                    : "bg-white text-zinc-600 hover:bg-zinc-100 border border-zinc-200"
                }`}
              >
                {tab}
                {count > 0 && (
                  <span className={`w-4 h-4 flex items-center justify-center rounded-full text-[9px] ${activeTab === tab ? "bg-white text-zinc-900" : "bg-zinc-200 text-zinc-600"}`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
        {filtered.length === 0 ? (
          <div className="flex flex-col flex-1 items-center justify-center p-8 text-center bg-white border border-zinc-200 border-dashed rounded-xl mt-4">
            <span className="text-2xl mb-2">📬</span>
            <h3 className="text-sm font-semibold text-[#111827]">No conversations found</h3>
            <p className="text-xs text-zinc-500 mt-1">Try switching filters or adjusting your search.</p>
          </div>
        ) : (
          filtered.map((item) => {
            const isActive = activeId === item.id;
            const isUnanswered = item.lastMessageSenderType === "customer";
            const isDraft = item.lastMessageSenderType === "ai_draft";
            const isAiHandled = item.lastMessageSenderType === "ai" || item.status === "negotiating";
            const customerName = item.customer?.name || item.customer?.email || "Unknown Customer";
            const timeAgo = formatRelativeTime(item.lastMessageAt);

            return (
              <Link key={item.id} href={`/dashboard/inbox/${item.id}`} className="block">
                <div className={`p-4 rounded-xl border transition-all duration-200 flex flex-col gap-2 relative ${
                  isActive 
                    ? "bg-teal-50/50 border-teal-200 shadow-sm before:content-[''] before:absolute before:left-[-1px] before:top-3 before:bottom-3 before:w-[3px] before:bg-teal-500 before:rounded-r-md" 
                    : "bg-white border-zinc-200 hover:border-zinc-300 hover:shadow-sm"
                }`}>
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2 min-w-0">
                      <h4 className={`text-sm tracking-tight truncate ${isUnanswered ? "font-bold text-[#111827]" : "font-semibold text-[#111827]"}`}>
                        {customerName}
                      </h4>
                      {isUnanswered && <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0" title="Needs Reply" />}
                    </div>
                    <span className="text-xs font-medium text-zinc-400 whitespace-nowrap pt-0.5">{timeAgo}</span>
                  </div>

                  <p className={`text-sm truncate ${isUnanswered ? "font-semibold text-zinc-900" : "font-medium text-zinc-600"}`}>
                    {item.lastMessageContent || item.subject || "No content"}
                  </p>
                  
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-zinc-100/80">
                    <div className="flex items-center gap-2">
                      <IntentBadge intent={item.intent} />
                      {isAiHandled && (
                        <div className="text-teal-600 bg-teal-50 px-1.5 py-0.5 rounded-md flex items-center gap-1 text-[10px] font-bold" title="AI Managed">
                          <BotIconSmall /> AI MANAGED
                        </div>
                      )}
                      {isDraft && (
                        <div className="text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-md flex items-center gap-1 text-[10px] font-bold" title="AI Draft Ready">
                          <SparklesIcon /> DRAFT READY
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-1.5 min-w-[100px] justify-end">
                      <button
                        onClick={(e) => handleResolveAI(e, item.id)}
                        disabled={!!resolvingId}
                        className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold transition-all ${
                          resolvingId === item.id
                            ? "bg-zinc-100 text-zinc-400 cursor-not-allowed"
                            : "bg-teal-500 text-white hover:bg-teal-600 shadow-sm opacity-0 group-hover:opacity-100 focus:opacity-100"
                        } ${isDraft ? "opacity-100!" : ""}`}
                        title="Resolve with AI"
                      >
                        {resolvingId === item.id ? (
                          <div className="w-2.5 h-2.5 border-2 border-zinc-300 border-t-zinc-500 rounded-full animate-spin" />
                        ) : (
                          "✨ AI REPLY"
                        )}
                      </button>
                      <div className="flex items-center gap-1.5 whitespace-nowrap">
                        <div className={`w-2 h-2 rounded-full ${item.status === 'resolved' || item.status === 'closed' ? "bg-zinc-300" : "bg-teal-500 shadow-[0_0_0_3px_rgba(20,184,166,0.1)]"}`} />
                        <span className="text-xs font-medium text-zinc-500 capitalize">{item.status.replace("_", " ")}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
