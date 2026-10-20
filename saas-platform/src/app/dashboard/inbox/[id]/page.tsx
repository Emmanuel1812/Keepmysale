"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { MessageThread } from "@/components/inbox/message-thread";
import { ReplyComposer } from "@/components/inbox/reply-composer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/page";
import { ArrowRightIcon, SparkIcon } from "@/components/ui/icons";

interface ApiMessage {
  id: string;
  sender: "customer" | "ai" | "human_agent" | "system" | "ai_draft" | "ai_scheduled";
  content: string;
  createdAt?: string;
  isScheduled?: boolean;
  scheduledSendAt?: string | null;
  metadata?: Record<string, unknown>;
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
        isScheduled: message.isScheduled ?? (message.metadata as any)?.original_sender === "ai_scheduled",
        scheduledSendAt: message.scheduledSendAt ?? null,
        facts: Array.isArray((message.metadata as any)?.facts_used) ? ((message.metadata as any).facts_used as string[]) : [],
        returnOptionStated: (message.metadata as any)?.return_option_stated === true,
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

  const handleSendNowAction = async (messageId: string) => {
    try {
      const res = await fetch(`/api/inbox/messages/${messageId}/send-now`, { method: "POST" });
      const payload = await res.json();
      if (payload.success) {
        await loadData();
      } else {
        alert("Failed to send scheduled message now: " + payload.error);
      }
    } catch (err) {
      alert("Error forcefully dispatching scheduled message.");
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
    return (
      <div className="flex h-full flex-col gap-4 bg-white p-6" aria-busy="true">
        <div className="flex items-center gap-3"><Skeleton className="h-10 w-10 !rounded-full" /><Skeleton className="h-5 w-48" /></div>
        <Skeleton className="h-16 w-2/3" />
        <Skeleton className="ml-auto h-20 w-1/2" />
        <Skeleton className="h-12 w-3/5" />
      </div>
    );
  }

  const customerName = conversation.customer?.name || "Unknown Customer";
  const customerEmail = conversation.customer?.email || "No email provided";
  const isOpen = conversation.status === "open" || conversation.status.startsWith("pending");

  const orderRef = conversation.shopifyOrderId?.split("/").pop() ?? null;

  return (
    <div className="relative flex h-full flex-col bg-white">
      {/* Header */}
      <div className="sticky top-0 z-10 flex flex-col gap-3 border-b border-line bg-white/95 px-5 py-4 backdrop-blur sm:px-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/dashboard/inbox" className="-ml-1 grid h-8 w-8 shrink-0 place-items-center rounded-[10px] text-muted hover:bg-surface-2 md:hidden" aria-label="Back to inbox">
              <ArrowRightIcon className="h-4 w-4 rotate-180" />
            </Link>
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-kept-soft text-base font-semibold text-kept-strong">
              {customerName.charAt(0).toUpperCase()}
            </div>
            <div className="flex min-w-0 flex-col">
              <h2 className="truncate text-base font-semibold text-foreground">{customerName}</h2>
              <span className="truncate text-[13px] text-muted">{customerEmail}</span>
            </div>
          </div>

          <Button size="sm" onClick={handleResolveAI} loading={isResolvingAI}>
            {isResolvingAI ? "Drafting" : <><SparkIcon className="h-4 w-4" /> AI reply</>}
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px]">
          <p className="min-w-0 truncate font-medium text-foreground">{conversation.subject ?? "No subject"}</p>
          <span className="flex items-center gap-2">
            <IntentBadge intent={conversation.intent} />
            <Badge variant={isOpen ? "teal" : "default"} dot>
              {conversation.status.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase())}
            </Badge>
          </span>
          {orderRef && (
            <Link href="/dashboard/orders" className="group flex items-center gap-1 font-medium text-kept-strong hover:underline">
              Order {orderRef} <ArrowRightIcon className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </Link>
          )}
        </div>
      </div>

      {/* Messages */}
      <MessageThread
         messages={threadMessages}
         onSendDraft={handleSendDraft}
         onDiscardDraft={handleDiscardDraft}
         onEditDraft={handleEditDraft}
         onSendNow={handleSendNowAction}
      />

      {/* Reply Composer */}
      <div className="sticky bottom-0 z-10 w-full border-t border-line bg-white">
        <ReplyComposer conversationId={conversationId} onSent={() => void loadData()} />
      </div>
    </div>
  );
}
