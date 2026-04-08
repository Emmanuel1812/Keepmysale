"use client";

import { useCallback, useEffect, useState } from "react";
import { ConversationList } from "@/components/inbox/conversation-list";

interface ApiConversation {
  id: string;
  status: string;
  subject: string | null;
}

export default function InboxPage() {
  const [items, setItems] = useState<Array<{ id: string; customer: string; preview: string; status: string }>>(
    [],
  );

  const loadConversations = useCallback(async () => {
    const response = await fetch("/api/inbox/conversations", { cache: "no-store" });
    const payload = (await response.json()) as { success: boolean; data?: { conversations: ApiConversation[] } };
    const mapped = (payload.data?.conversations ?? []).map((conversation) => ({
      id: conversation.id,
      customer: "Customer",
      preview: conversation.subject ?? "No subject",
      status: conversation.status,
    }));
    setItems(mapped);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadConversations();
    const interval = setInterval(() => {
      void loadConversations();
    }, 8000);
    return () => clearInterval(interval);
  }, [loadConversations]);

  return (
    <div className="grid min-h-[70vh] gap-4 lg:grid-cols-[360px_1fr]">
      <ConversationList items={items} />
      <div className="flex items-center justify-center rounded-lg border border-zinc-200 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-300">
        Select a conversation to open the thread.
      </div>
    </div>
  );
}
