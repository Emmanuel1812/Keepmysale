"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

const AttachIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>);
const SendIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>);

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
    <div className="flex flex-col gap-2 rounded-xl border border-zinc-200 bg-[#f8fafb] p-3 mx-4 mb-4">
      <textarea
        className="w-full resize-none border-none bg-transparent p-2 text-sm outline-none placeholder:text-zinc-400 min-h[80px]"
        placeholder="Type a reply..."
        rows={3}
        value={content}
        onChange={(event) => setContent(event.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            handleSend();
          }
        }}
      />
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-zinc-200/60">
        <button 
          className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-zinc-600 hover:text-[#111827] hover:bg-zinc-100 rounded-md transition-colors"
          title="Attach file (mocked)"
        >
          <AttachIcon />
          Attach
        </button>
        <button 
          onClick={handleSend} 
          disabled={sending || !content.trim()}
          className="flex items-center gap-2 px-4 py-1.5 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-50 disabled:hover:bg-teal-600 rounded-lg shadow-sm transition-all"
        >
          {sending ? "Sending..." : "Send"}
          <SendIcon />
        </button>
      </div>
    </div>
  );
}
