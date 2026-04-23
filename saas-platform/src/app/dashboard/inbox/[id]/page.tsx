"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { MessageThread } from "@/components/inbox/message-thread";
import { ReplyComposer } from "@/components/inbox/reply-composer";

interface ApiMessage {
  id: string;
  sender: "customer" | "ai" | "human_agent" | "system";
  content: string;
  createdAt?: string;
}

interface ApiConversation {
  id: string;
  status: string;
  subject: string | null;
  intent: string | null;
  aiResolved: boolean;
  shopifyOrderId: string | null;
  customer?: { name?: string | null; email?: string | null };
}

function IntentBadge({ intent }: { intent: string | null }) {
  if (!intent) return null;
  const normalized = intent.toLowerCase();
  let colorClass = "bg-zinc-100 text-zinc-600 border border-zinc-200";
  if (normalized === "wismo") colorClass = "bg-blue-50 text-blue-700 border border-blue-200";
  else if (normalized === "return" || normalized === "exchange") colorClass = "bg-orange-50 text-orange-700 border border-orange-200";
  else if (normalized === "complaint") colorClass = "bg-red-50 text-red-700 border border-red-200";
  else if (normalized === "faq") colorClass = "bg-indigo-50 text-indigo-700 border border-indigo-200";

  return (
    <span className={`text-xs uppercase font-bold tracking-wider px-2 py-0.5 rounded-md ${colorClass} flex items-center gap-1 w-fit`}>
      🏷️ {intent}
    </span>
  );
}

export default function ConversationThreadPage() {
  const params = useParams<{ id: string }>();
  const conversationId = params?.id;
  const [messages, setMessages] = useState<ApiMessage[]>([]);
  const [conversation, setConversation] = useState<ApiConversation | null>(null);
  const [isResolvingAI, setIsResolvingAI] = useState(false);

  const loadData = useCallback(async () => {
    if (!conversationId) return;
    try {
      // Load conversation details
      const convRes = await fetch("/api/inbox/conversations", { cache: "no-store" });
      const convPayload = await convRes.json();
      if (convPayload.success) {
        const found = convPayload.data?.conversations?.find((c: any) => c.id === conversationId);
        if (found) setConversation(found);
      }

      // Load messages
      const msgRes = await fetch(`/api/inbox/conversations/${conversationId}/messages`, { cache: "no-store" });
      const msgPayload = await msgRes.json();
      if (msgPayload.success) {
        setMessages(msgPayload.data?.messages ?? []);
      }
    } catch {}
  }, [conversationId]);

  useEffect(() => {
    void loadData();
    if (!conversationId) return;
    const interval = setInterval(() => void loadData(), 8000);
    return () => clearInterval(interval);
  }, [conversationId, loadData]);

  const threadMessages = useMemo(
    () =>
      messages.map((message) => ({
        id: message.id,
        sender: message.sender,
        body: message.content,
        createdAt: message.createdAt,
      })),
    [messages],
  );
  
  const handleResolveAI = async () => {
    if (!conversationId || isResolvingAI) return;
    
    setIsResolvingAI(true);
    try {
      const response = await fetch(`/api/inbox/conversations/${conversationId}/resolve-ai`, {
        method: "POST"
      });
      const data = await response.json();
      
      if (data.success) {
        await loadData();
        // Optioneel: toast success
      } else {
        alert("AI error: " + (data.message || "Failed to generate response"));
      }
    } catch (err) {
      console.error("AI Resolve failed", err);
    } finally {
      setIsResolvingAI(false);
    }
  };

  const handleSendDraft = async (messageId: string) => {
    try {
      const res = await fetch(`/api/inbox/messages/${messageId}/send`, { method: "POST" });
      const payload = await res.json();
      if (payload.success) {
        await loadData();
      } else {
        alert("Failed to send draft: " + payload.error);
      }
    } catch (err) {
      alert("Error sending draft message.");
    }
  };

  const handleDiscardDraft = async (messageId: string) => {
    if (!confirm("Are you sure you want to discard this draft?")) return;
    try {
      const res = await fetch(`/api/inbox/messages/${messageId}`, { method: "DELETE" });
      const payload = await res.json();
      if (payload.success) {
        await loadData();
      } else {
        alert("Failed to delete draft.");
      }
    } catch (err) {
       alert("Error discarding draft.");
    }
  };

  const handleEditDraft = async (messageId: string, newContent: string) => {
    try {
       const res = await fetch(`/api/inbox/messages/${messageId}/edit`, {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({ content: newContent })
       });
       const payload = await res.json();
       if (payload.success) {
         await loadData();
       } else {
         alert("Failed to save draft edits.");
       }
    } catch (err) {
       alert("Error saving draft.");
    }
  };

  if (!conversation) {
    return <div className="flex h-full items-center justify-center bg-white"><div className="animate-pulse flex items-center text-teal-600 font-semibold gap-2"><span>Loading thread...</span></div></div>;
  }

  const customerName = conversation.customer?.name || "Unknown Customer";
  const customerEmail = conversation.customer?.email || "No email provided";
  const isOpen = conversation.status === "open" || conversation.status.startsWith("pending");

  return (
    <div className="flex flex-col h-full bg-white relative">
      {/* Header */}
      <div className="border-b border-zinc-200 px-6 py-4 flex flex-col gap-4 sticky top-0 bg-white/95 backdrop-blur z-10">
        
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 shrink-0 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 font-bold text-lg">
              {customerName.charAt(0).toUpperCase()}
            </div>
            <div className="flex flex-col">
              <h2 className="text-base font-bold text-[#111827]">{customerName}</h2>
              <span className="text-sm text-zinc-500">{customerEmail}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={handleResolveAI}
              disabled={isResolvingAI}
              className={`px-3 py-1.5 text-xs font-bold rounded-md border border-teal-200 bg-teal-600 text-white hover:bg-teal-700 transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {isResolvingAI ? (
                <div className="h-3 w-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <span className="text-[14px]">✨</span>
              )}
              {isResolvingAI ? "AI Thinking..." : "✨ AI Reply"}
            </button>
            <button className="px-3 py-1.5 text-xs font-semibold rounded-md border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 shadow-sm transition-colors">
              Assign to Me
            </button>
            <button className="px-3 py-1.5 text-xs font-semibold rounded-md border border-teal-200 bg-teal-50 text-teal-700 hover:bg-teal-100 transition-colors shadow-sm">
              Mark Resolved
            </button>
          </div>
        </div>

        <div>
          <p className="text-sm font-semibold text-[#111827] flex items-center gap-2">
            <span className="text-zinc-500 font-normal">Subject:</span> {conversation.subject ?? "No Subject"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-sm bg-[#f8fafb] rounded-lg p-3 border border-zinc-100">
          <div className="flex items-center gap-2 font-medium">
            <span className="text-zinc-500">Intent:</span>
            <IntentBadge intent={conversation.intent} />
          </div>
          
          <div className="h-4 w-px bg-zinc-200" />
          
          <div className="flex items-center gap-2 font-medium">
            <span className="text-zinc-500">Status:</span>
            <div className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${isOpen ? "bg-teal-500" : "bg-zinc-300"}`} />
              <span className="capitalize">{conversation.status.replace("_", " ")}</span>
            </div>
          </div>

          {conversation.shopifyOrderId && (
            <>
              <div className="h-4 w-px bg-zinc-200" />
              <div className="flex items-center gap-2 font-medium">
                <span className="text-zinc-500">Order:</span>
                <span>#{conversation.shopifyOrderId}</span>
                <Link href={`/dashboard/orders/${conversation.shopifyOrderId}`} className="text-teal-600 hover:text-teal-700 ml-1 hover:underline">
                  [View Order &rarr;]
                </Link>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Messages */}
      <MessageThread 
         messages={threadMessages} 
         onSendDraft={handleSendDraft} 
         onDiscardDraft={handleDiscardDraft} 
         onEditDraft={handleEditDraft} 
      />
      
      {/* Reply Composer */}
      <div className="sticky bottom-0 bg-white pt-2 border-t border-transparent z-10 w-full">
        <ReplyComposer conversationId={conversationId} onSent={() => void loadData()} />
      </div>
    </div>
  );
}
