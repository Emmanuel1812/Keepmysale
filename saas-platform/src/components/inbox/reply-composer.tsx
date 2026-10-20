"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

const SendIcon = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>);

interface ReplyComposerProps {
  conversationId: string;
  onSent?: () => void;
}

export function ReplyComposer({ conversationId, onSent }: ReplyComposerProps) {
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSend() {
    if (!content.trim() || sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/inbox/conversations/${conversationId}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) throw new Error();
      setContent("");
      onSent?.();
    } catch {
      setError("Your reply was not sent. It is still here; try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="p-3 sm:p-4">
      <div className="rounded-[14px] bg-surface-2 ring-1 ring-inset ring-line transition-shadow focus-within:bg-white focus-within:shadow-[0_0_0_3px_rgb(13_148_136/0.15)] focus-within:ring-kept">
        <label className="sr-only" htmlFor={`reply-${conversationId}`}>Reply</label>
        <textarea
          id={`reply-${conversationId}`}
          className="block min-h-[76px] w-full resize-none bg-transparent px-4 pt-3 text-sm text-foreground placeholder:text-faint focus:outline-none"
          placeholder="Write a reply"
          rows={3}
          value={content}
          onChange={(event) => setContent(event.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              void handleSend();
            }
          }}
        />
        <div className="flex items-center justify-between gap-3 px-3 pb-3">
          <span className="text-xs text-faint">{error ? <span className="text-lost">{error}</span> : "Ctrl + Enter to send"}</span>
          <Button size="sm" onClick={handleSend} disabled={!content.trim()} loading={sending}>
            {sending ? "Sending" : <>Send <SendIcon /></>}
          </Button>
        </div>
      </div>
    </div>
  );
}
