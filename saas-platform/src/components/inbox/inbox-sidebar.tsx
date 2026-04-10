"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

// --- [ICONS] ---
const SearchIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>);
const BotIconSmall = () => (<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="14" x="3" y="6" rx="2" ry="2"/><path d="M12 2v4"/><path d="M8 12h.01"/><path d="M16 12h.01"/><path d="M12 16c-2 0-3-1-3-1"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg>);

interface ApiConversation {
  id: string;
  status: string;
  subject: string | null;
  intent: string | null;
  aiResolved: boolean;
  lastMessageAt: string;
  customer?: { name?: string | null; email?: string | null };
}

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
  const [filter, setFilter] = useState<"All" | "Open" | "Resolved" | "AI Handled">("All");

  const loadConversations = useCallback(async () => {
    try {
      const response = await fetch("/api/inbox/conversations", { cache: "no-store" });
      const payload = await response.json();
      if (payload.success) setConversations(payload.data?.conversations ?? []);
    } catch {}
  }, []);

  useEffect(() => {
    void loadConversations();
    const interval = setInterval(() => void loadConversations(), 8000);
    return () => clearInterval(interval);
  }, [loadConversations]);

  const openCount = conversations.filter((c) => c.status === "open" || c.status.startsWith("pending")).length;

  const filtered = conversations.filter((c) => {
    if (filter === "Open" && !(c.status === "open" || c.status.startsWith("pending"))) return false;
    if (filter === "Resolved" && c.status !== "resolved" && c.status !== "closed") return false;
    if (filter === "AI Handled" && !c.aiResolved && c.status !== "pending_human") return false; // Approximation
    
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

  return (
    <div className="flex w-full flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-zinc-200 bg-white">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-[#111827] flex items-center gap-2">
            Inbox
            {openCount > 0 && (
              <span className="bg-teal-100 text-teal-800 text-xs font-bold px-2 py-0.5 rounded-full">
                {openCount} new
              </span>
            )}
          </h2>
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

        {/* Filter Tabs */}
        <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide -mx-1 px-1">
          {["All", "Open", "Resolved", "AI Handled"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f as any)}
              className={`whitespace-nowrap px-3 py-1 text-xs font-semibold rounded-full transition-colors ${
                filter === f 
                  ? "bg-[#111827] text-white" 
                  : "bg-white text-zinc-600 hover:bg-zinc-100 border border-zinc-200"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
        {filtered.length === 0 ? (
          <div className="flex flex-col flex-1 items-center justify-center p-8 text-center bg-white border border-zinc-200 border-dashed rounded-xl mt-4">
            <span className="text-2xl mb-2">📬</span>
            <h3 className="text-sm font-semibold text-[#111827]">No conversations yet</h3>
            <p className="text-xs text-zinc-500 mt-1">Emails will appear here automatically.</p>
          </div>
        ) : (
          filtered.map((item) => {
            const isActive = activeId === item.id;
            const isOpen = item.status === "open" || item.status.startsWith("pending");
            const customerName = item.customer?.name || item.customer?.email || "Unknown Customer";
            const timeAgo = formatRelativeTime(item.lastMessageAt);
            const isAiEngaged = item.status === "pending_human" || item.aiResolved || ["wismo", "return"].includes(item.intent || ""); // Naive check for UI mock

            return (
              <Link key={item.id} href={`/dashboard/inbox/${item.id}`} className="block">
                <div className={`p-4 rounded-xl border transition-all duration-200 flex flex-col gap-2 relative ${
                  isActive 
                    ? "bg-teal-50/50 border-teal-200 shadow-sm before:content-[''] before:absolute before:left-[-1px] before:top-3 before:bottom-3 before:w-[3px] before:bg-teal-500 before:rounded-r-md" 
                    : "bg-white border-zinc-200 hover:border-zinc-300 hover:shadow-sm"
                }`}>
                  <div className="flex justify-between items-start">
                    <h4 className={`text-sm tracking-tight truncate pr-2 ${isOpen ? "font-bold text-[#111827]" : "font-semibold text-[#111827]"}`}>
                      {customerName}
                    </h4>
                    <span className="text-xs font-medium text-zinc-400 whitespace-nowrap pt-0.5">{timeAgo}</span>
                  </div>

                  <p className={`text-sm truncate ${isOpen ? "font-semibold text-zinc-900" : "font-medium text-zinc-700"}`}>
                    {item.subject ?? "No Subject"}
                  </p>
                  
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-zinc-100/80">
                    <div className="flex items-center gap-2">
                      <IntentBadge intent={item.intent} />
                      {isAiEngaged && (
                        <div className="text-teal-600 bg-teal-50 p-1 rounded-md" title="AI Responded">
                          <BotIconSmall />
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-1.5">
                      <div className={`w-2 h-2 rounded-full ${isOpen ? "bg-teal-500 shadow-[0_0_0_3px_rgba(20,184,166,0.1)]" : "bg-zinc-300"}`} />
                      <span className="text-xs font-medium text-zinc-500 capitalize">{item.status.replace("_", " ")}</span>
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
