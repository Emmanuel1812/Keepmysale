"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";

interface ThreadMessage {
  id: string;
  sender: "customer" | "ai" | "human_agent" | "system" | "ai_draft" | "ai_scheduled";
  body: string;
  createdAt?: string;
  isScheduled?: boolean;
  scheduledSendAt?: string | null;
}

interface MessageThreadProps {
  messages: ThreadMessage[];
  onSendDraft?: (id: string) => Promise<void>;
  onDiscardDraft?: (id: string) => Promise<void>;
  onEditDraft?: (id: string, newContent: string) => Promise<void>;
  onSendNow?: (id: string) => Promise<void>;
}

// --- Icons ---
const BotIconSmall = () => (<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="14" x="3" y="6" rx="2" ry="2"/><path d="M12 2v4"/><path d="M8 12h.01"/><path d="M16 12h.01"/><path d="M12 16c-2 0-3-1-3-1"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg>);
const EditIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>);
const SendIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>);
const TrashIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>);
const ClockIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>);
const ZapIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>);

// --- Countdown Helper ---
function formatCountdown(scheduledSendAt: string): string {
  const target = new Date(scheduledSendAt).getTime();
  const now = Date.now();
  const diff = target - now;

  if (diff <= 0) {
    return "Wacht op verzending...";
  }

  const totalMinutes = Math.floor(diff / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0 && minutes > 0) return `${hours}u ${minutes}m`;
  if (hours > 0) return `${hours}u`;
  return `${minutes}m`;
}

// --- Countdown Component ---
function CountdownTimer({ scheduledSendAt }: { scheduledSendAt: string }) {
  const [countdownText, setCountdownText] = useState(() => formatCountdown(scheduledSendAt));

  useEffect(() => {
    setCountdownText(formatCountdown(scheduledSendAt));
    const interval = setInterval(() => {
      setCountdownText(formatCountdown(scheduledSendAt));
    }, 60000); // update every minute
    return () => clearInterval(interval);
  }, [scheduledSendAt]);

  return (
    <span className="flex items-center gap-1.5 text-xs font-medium text-amber-700">
      <ClockIcon /> ⏱️ Wordt verzonden over {countdownText}
    </span>
  );
}

// --- Main Component ---
export function MessageThread({ messages, onSendDraft, onDiscardDraft, onEditDraft, onSendNow }: MessageThreadProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [isSending, setIsSending] = useState<string | null>(null);

  const handleSaveEdit = async (id: string) => {
    if (onEditDraft) {
      await onEditDraft(id, editContent);
    }
    setEditingId(null);
  };

  const isScheduledMessage = useCallback((msg: ThreadMessage) => {
    return msg.isScheduled === true || msg.sender === "ai_scheduled";
  }, []);

  const isDraftMessage = useCallback((msg: ThreadMessage) => {
    return msg.sender === "ai_draft" && !msg.isScheduled;
  }, []);

  return (
    <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
      {messages.length === 0 ? (
        <div className="flex items-center justify-center h-full text-zinc-500 text-sm">
          No messages in this thread yet.
        </div>
      ) : (
        messages.map((message) => {
          const isCustomer = message.sender === "customer";
          const isAi = message.sender === "ai";
          const isSystem = message.sender === "system";
          const isScheduled = isScheduledMessage(message);
          const isDraft = isDraftMessage(message);
          const isAiType = isAi || isDraft || isScheduled;

          if (isSystem) {
            return (
              <div key={message.id} className="self-center my-4">
                <span className="bg-zinc-100 text-zinc-500 text-xs px-3 py-1 rounded-full font-medium">
                  {message.body}
                </span>
              </div>
            );
          }

          return (
            <div
              key={message.id}
              className={`flex flex-col max-w-[85%] ${isCustomer ? "self-start" : "self-end"}`}
            >
              {/* Message Bubble */}
              <div
                className={`rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed shadow-sm ${
                  isCustomer
                    ? "bg-[#f1f5f9] text-[#111827] rounded-tl-sm border border-zinc-200/60"
                    : isAiType
                      ? "bg-teal-600 text-white rounded-tr-sm"
                      : "bg-blue-600 text-white rounded-tr-sm"
                } ${isDraft ? "opacity-75 border border-dashed border-teal-300" : ""}
                  ${isScheduled ? "border border-dashed border-amber-300" : ""}`}
              >
                {editingId === message.id ? (
                  <div className="flex flex-col gap-2 min-w-[300px]">
                    <textarea
                      className="w-full text-black p-2 rounded-md border border-teal-200 outline-none text-sm resize-none"
                      rows={4}
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      autoFocus
                    />
                    <div className="flex gap-2 justify-end">
                      <Button variant="secondary" size="sm" className="h-7 text-xs bg-white text-zinc-700 hover:bg-zinc-100" onClick={() => setEditingId(null)}>Cancel</Button>
                      <Button variant="default" size="sm" className="h-7 text-xs bg-teal-800 hover:bg-teal-900" onClick={() => handleSaveEdit(message.id)}>Save Edit</Button>
                    </div>
                  </div>
                ) : (
                  <div className="whitespace-pre-wrap">{message.body}</div>
                )}
              </div>

              {/* ======= SCHEDULED MESSAGE: Countdown + Action buttons ======= */}
              {isScheduled && editingId !== message.id && (
                <div className="flex flex-col gap-2 mt-2 self-end">
                  {/* Countdown Timer */}
                  {message.scheduledSendAt && (
                    <div className="bg-amber-50 border border-amber-200 px-3 py-2 rounded-lg w-fit self-end">
                      <CountdownTimer scheduledSendAt={message.scheduledSendAt} />
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 bg-zinc-50 border border-zinc-200 p-1.5 rounded-lg w-fit shadow-xs self-end">
                    <Button
                      variant="default"
                      size="sm"
                      className="h-8 text-xs px-3 bg-amber-500 hover:bg-amber-600 text-white"
                      disabled={isSending !== null}
                      onClick={async () => {
                        if (onSendNow) {
                          setIsSending(message.id);
                          await onSendNow(message.id);
                          setIsSending(null);
                        }
                      }}
                    >
                      {isSending === message.id ? (
                        <div className="h-3 w-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : <ZapIcon />}
                      {isSending === message.id ? "Verzenden..." : "Nu Versturen"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs px-3 text-zinc-600 border-zinc-200 bg-white"
                      onClick={() => { setEditingId(message.id); setEditContent(message.body); }}
                      disabled={isSending !== null}
                    >
                      <EditIcon /> Bewerken
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="h-8 text-xs px-3 bg-red-50 text-red-600 border border-red-100 hover:bg-red-100 shadow-none"
                      onClick={() => onDiscardDraft && onDiscardDraft(message.id)}
                      disabled={isSending !== null}
                    >
                      <TrashIcon /> Verwijderen
                    </Button>
                  </div>
                </div>
              )}

              {/* ======= DRAFT MESSAGE: Send/Edit/Discard buttons ======= */}
              {isDraft && editingId !== message.id && (
                <div className="flex items-center gap-2 mt-2 bg-zinc-50 border border-zinc-200 p-1.5 rounded-lg w-fit shadow-xs self-end">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs px-3 text-zinc-600 border-zinc-200 bg-white"
                    onClick={() => { setEditingId(message.id); setEditContent(message.body); }}
                    disabled={isSending !== null}
                  >
                    <EditIcon /> Edit
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="h-8 text-xs px-3 bg-red-50 text-red-600 border border-red-100 hover:bg-red-100 shadow-none"
                    onClick={() => onDiscardDraft && onDiscardDraft(message.id)}
                    disabled={isSending !== null}
                  >
                    <TrashIcon /> Discard
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    className="h-8 text-xs px-3 bg-teal-600 hover:bg-teal-700 text-white"
                    disabled={isSending !== null}
                    onClick={async () => {
                      if (onSendDraft) {
                        setIsSending(message.id);
                        await onSendDraft(message.id);
                        setIsSending(null);
                      }
                    }}
                  >
                    {isSending === message.id ? (
                      <div className="h-3 w-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : <SendIcon />}
                    {isSending === message.id ? "Sending..." : "Send Draft"}
                  </Button>
                </div>
              )}

              {/* ======= Sender label + timestamp ======= */}
              <div className={`flex items-center gap-1.5 mt-1 mx-1 text-[11px] font-medium text-zinc-400 ${isCustomer ? "justify-start" : "justify-end"}`}>
                {isAiType && (
                  <span className="flex items-center gap-1 text-teal-600">
                    <BotIconSmall />
                    {isScheduled ? "AI Agent (Gepland)" : isDraft ? "AI Agent (Draft)" : "AI Agent"}
                  </span>
                )}
                {!isAiType && !isCustomer && "You"}
                <span>•</span>
                <span>{message.createdAt ? new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Just now"}</span>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
