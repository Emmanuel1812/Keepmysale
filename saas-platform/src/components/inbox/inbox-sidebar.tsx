"use client";

import { isSupportConversation } from "@/lib/inbox-visibility";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/page";
import { ChatIcon, SearchIcon, SparkIcon, SyncIcon } from "@/components/ui/icons";

interface ApiConversation {
  id: string;
  status: string;
  subject: string | null;
  intent: string | null;
  category?: string | null;
  hasHumanReply?: boolean;
  isKnownCustomer?: boolean;
  aiResolved: boolean;
  lastMessageAt: string;
  lastMessageSenderType: string | null;
  lastMessageContent: string | null;
  customer?: { name?: string | null; email?: string | null };
}

type TTab = "All" | "Customers" | "Returns" | "Shipping" | "Products" | "Drafts" | "Human Required" | "Filtered";
const TABS: TTab[] = ["All", "Customers", "Returns", "Shipping", "Products", "Drafts", "Human Required", "Filtered"];

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

const INTENT_LABEL: Record<string, string> = {
  wismo: "Where is my order",
  return: "Return",
  exchange: "Exchange",
  complaint: "Complaint",
  faq: "Question",
  resend_confirmation: "Confirmation",
  other: "Other",
};

function IntentBadge({ intent }: { intent: string | null }) {
  if (!intent) return null;
  const normalized = intent.toLowerCase();
  const variant = normalized === "return" || normalized === "exchange" ? "amber" : normalized === "complaint" ? "rose" : "default";
  return <Badge variant={variant}>{INTENT_LABEL[normalized] ?? intent}</Badge>;
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
  const [loading, setLoading] = useState(true);

  const loadConversations = useCallback(async () => {
    try {
      const response = await fetch("/api/inbox/conversations", { cache: "no-store" });
      const payload = await response.json();
      if (payload.success) setConversations(payload.data?.conversations ?? []);
    } catch {
    } finally {
      setLoading(false);
    }
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
    } else if (activeTab === "Filtered") {
      if (isSupportConversation(c)) return false;
    } else if (activeTab === "All") {
      // Newsletters, bounces, banks and senders who never ordered live under "Filtered".
      if (!isSupportConversation(c)) return false;
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
      if (tab === "All") return isSupportConversation(c);
      if (tab === "Customers") {
        return c.isKnownCustomer === true && !["spam", "financial"].includes(cat as any);
      }
      if (tab === "Returns") return (["returns", "negotiation_active", "negotiation_accepted", "negotiation_rejected"] as (string | null)[]).includes(cat);
      if (tab === "Shipping") return cat === "shipping";
      if (tab === "Products") return cat === "product";
      if (tab === "Human Required") return cat === "human_required";
      if (tab === "Filtered") return !isSupportConversation(c);
      return false;
    }).length;
  };

  const totalActionable = getUnreadCount("All");

  return (
    <div className="flex h-full w-full flex-col">
      {/* Header */}
      <div className="border-b border-line bg-white px-4 pb-3 pt-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold tracking-[-0.02em] text-foreground">Inbox</h2>
            {totalActionable > 0 && (
              <span className="kms-ping rounded-full bg-kept px-2 py-0.5 text-[11px] font-bold text-white tabular" title="Waiting for an answer">
                {totalActionable}
              </span>
            )}
          </div>

          <button
            onClick={handleSync}
            disabled={syncing}
            className="kms-press flex h-8 items-center gap-1.5 rounded-[10px] px-2.5 text-[13px] font-semibold text-kept-strong hover:bg-kept-soft disabled:cursor-not-allowed disabled:text-faint"
          >
            <SyncIcon className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Syncing" : "Sync"}
          </button>
        </div>

        {/* Search */}
        <label className="relative mb-3 block">
          <span className="sr-only">Search conversations</span>
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
          <input
            type="text"
            className="block h-9 w-full rounded-[10px] border border-line bg-surface-2 pl-9 pr-3 text-sm text-foreground transition-[border-color,box-shadow] placeholder:text-faint focus:border-kept focus:bg-white focus:shadow-[0_0_0_3px_rgb(13_148_136/0.15)] focus:outline-none"
            placeholder="Search name, email or subject"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>

        {/* Filter pills */}
        <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1" role="tablist" aria-label="Filter conversations">
          {TABS.map((tab) => {
            const count = getUnreadCount(tab);
            const on = activeTab === tab;
            return (
              <button
                key={tab}
                role="tab"
                aria-selected={on}
                onClick={() => setActiveTab(tab)}
                className={`kms-press flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${
                  on ? "bg-ink text-white" : "bg-white text-muted ring-1 ring-inset ring-line hover:bg-surface-2 hover:text-foreground"
                }`}
              >
                {tab}
                {count > 0 && (
                  <span className={`min-w-4 rounded-full px-1 text-center text-[10px] tabular ${on ? "bg-kept-glow text-ink" : "bg-surface-2 text-muted"}`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <label className="mt-2 flex w-fit cursor-pointer select-none items-center gap-2 px-1 text-xs font-medium text-muted">
          <input
            type="checkbox"
            checked={showResolved}
            onChange={(e) => setShowResolved(e.target.checked)}
            className="h-3.5 w-3.5 rounded accent-[var(--kept)]"
          />
          Show resolved
        </label>
      </div>

      {/* List */}
      <div className="flex flex-1 flex-col gap-1.5 overflow-y-auto p-2.5">
        {loading && conversations.length === 0 ? (
          [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[92px] w-full !rounded-[12px]" />)
        ) : filtered.length === 0 ? (
          <div className="mt-6 flex flex-col items-center px-6 text-center">
            <span className="mb-3 grid h-11 w-11 place-items-center rounded-2xl bg-kept-soft text-kept-strong"><ChatIcon className="h-5 w-5" /></span>
            <h3 className="text-sm font-semibold text-foreground">{search ? "No matches" : "Nothing here"}</h3>
            <p className="mt-1 text-xs text-muted">{search ? "Try another name, email or subject." : "Conversations in this filter show up here."}</p>
          </div>
        ) : (
          filtered.map((item, index) => {
            const isActive = activeId === item.id;
            const isUnanswered = item.lastMessageSenderType === "customer";
            const isDraft = item.lastMessageSenderType === "ai_draft";
            const isAiHandled = item.lastMessageSenderType === "ai" || item.status === "negotiating";
            const isResolved = item.status === "resolved" || item.status === "closed";
            const customerName = item.customer?.name || item.customer?.email || "Unknown customer";
            const timeAgo = formatRelativeTime(item.lastMessageAt);

            return (
              <Link
                key={item.id}
                href={`/dashboard/inbox/${item.id}`}
                aria-current={isActive ? "page" : undefined}
                className={`group kms-enter relative block rounded-[12px] px-3.5 py-3 transition-[background-color,box-shadow] duration-150 ${
                  isActive ? "bg-white shadow-card ring-1 ring-inset ring-[#bfe7e2]" : "hover:bg-white hover:shadow-card"
                }`}
                style={{ ["--i" as string]: Math.min(index, 6) }}
              >
                {isActive ? <span aria-hidden="true" className="absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full bg-kept" /> : null}
                <div className="flex items-start gap-3">
                  <span className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full text-[13px] font-semibold uppercase ${isUnanswered ? "bg-kept text-white" : "bg-[#e7ecf0] text-muted"}`}>
                    {customerName.charAt(0)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <h4 className={`truncate text-sm ${isUnanswered ? "font-semibold text-foreground" : "font-medium text-foreground"}`}>{customerName}</h4>
                      <span className={`shrink-0 text-[11px] tabular ${isUnanswered ? "font-semibold text-kept-strong" : "text-faint"}`}>{timeAgo}</span>
                    </div>
                    <p className={`mt-0.5 truncate text-[13px] ${isUnanswered ? "text-foreground" : "text-muted"}`}>
                      {item.lastMessageContent || item.subject || "No content"}
                    </p>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                        <IntentBadge intent={item.intent} />
                        {isDraft && <Badge variant="amber" dot>Draft ready</Badge>}
                        {!isDraft && isAiHandled && <Badge variant="teal">Answered by AI</Badge>}
                        {isResolved && <Badge>Resolved</Badge>}
                      </div>
                      <button
                        onClick={(e) => handleResolveAI(e, item.id)}
                        disabled={!!resolvingId}
                        className={`kms-press flex h-7 shrink-0 items-center gap-1 rounded-[8px] px-2 text-[11px] font-semibold transition-opacity ${
                          resolvingId === item.id
                            ? "cursor-not-allowed bg-surface-2 text-faint opacity-100"
                            : "bg-kept text-white hover:bg-kept-strong opacity-0 focus:opacity-100 group-hover:opacity-100"
                        } ${isDraft ? "opacity-100" : ""}`}
                        title="Let the AI draft a reply"
                      >
                        {resolvingId === item.id ? <SyncIcon className="h-3.5 w-3.5 animate-spin" /> : <SparkIcon className="h-3.5 w-3.5" />}
                        {resolvingId === item.id ? "Drafting" : "AI reply"}
                      </button>
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
