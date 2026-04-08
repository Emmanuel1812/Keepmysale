"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ReplyComposerProps {
  conversationId: string;
  onSent?: () => void;
}

export function ReplyComposer({ conversationId, onSent }: ReplyComposerProps) {
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);

  async function handleSend() {
    if (!content.trim() || sending) return;
    setSending(true);
    try {
      await fetch(`/api/inbox/conversations/${conversationId}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      setContent("");
      onSent?.();
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex items-center gap-2 rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
      <Input
        placeholder="Write a reply..."
        value={content}
        onChange={(event) => setContent(event.target.value)}
      />
      <Button onClick={handleSend} disabled={sending}>
        {sending ? "Sending..." : "Send"}
      </Button>
    </div>
  );
}
