"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { MessageThread } from "@/components/inbox/message-thread";
import { ReplyComposer } from "@/components/inbox/reply-composer";

interface ApiMessage {
  id: string;
  sender: "customer" | "ai" | "human_agent" | "system";
  content: string;
}

export default function ConversationThreadPage() {
  const params = useParams<{ id: string }>();
  const conversationId = params.id;
  const [messages, setMessages] = useState<ApiMessage[]>([]);

  const loadMessages = useCallback(async () => {
    if (!conversationId) return;
    const response = await fetch(`/api/inbox/conversations/${conversationId}/messages`, { cache: "no-store" });
    const payload = (await response.json()) as { success: boolean; data?: { messages: ApiMessage[] } };
    setMessages(payload.data?.messages ?? []);
  }, [conversationId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadMessages();
    if (!conversationId) return;
    const interval = setInterval(() => void loadMessages(), 8000);
    return () => clearInterval(interval);
  }, [conversationId, loadMessages]);

  const threadMessages = useMemo(
    () =>
      messages.map((message) => ({
        id: message.id,
        sender: (message.sender === "customer" ? "customer" : "ai") as "customer" | "ai",
        body: message.content,
      })),
    [messages],
  );

  return (
    <div className="grid min-h-[70vh] grid-rows-[1fr_auto] gap-4">
      <div>
        <h2 className="mb-3 text-lg font-semibold">Conversation {conversationId}</h2>
        <MessageThread messages={threadMessages} />
      </div>
      <ReplyComposer conversationId={conversationId} onSent={() => void loadMessages()} />
    </div>
  );
}
