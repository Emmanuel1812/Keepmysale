"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";

interface ThreadMessage {
  id: string;
  sender: "customer" | "ai" | "human_agent" | "system" | "ai_draft" | "ai_scheduled";
  body: string;
  createdAt?: string;
  isScheduled?: boolean;
  scheduledSendAt?: string | null;
  /** Order facts the AI answer was built on */
  facts?: string[];
  /** The offer told the customer they can still send it back for a full refund */
  returnOptionStated?: boolean;
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

  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h`;
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
    <span className="flex items-center gap-1.5 text-xs font-medium text-attention">
      <ClockIcon /> Sends in {countdownText}
    </span>
  );
}

// --- Main Component ---
export function MessageThread({ messages, onSendDraft, onDiscardDraft, onEditDraft, onSendNow }: MessageThreadProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [isSending, setIsSending] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const newestId = messages[messages.length - 1]?.id;

  // Open at the newest message (the one to act on), and follow new ones; a long thread used to open at its first mail
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [newestId]);

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
    <div ref={scrollRef} className="flex flex-1 flex-col gap-5 overflow-y-auto bg-surface-2/60 px-4 py-6 sm:px-6">
      {messages.length === 0 ? (
        <div className="flex h-full items-center justify-center text-sm text-muted">
          No messages in this conversation yet.
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
                <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-muted shadow-card">
                  {message.body}
                </span>
              </div>
            );
          }

          return (
            <div
              key={message.id}
              className={`kms-enter flex max-w-[85%] flex-col ${isCustomer ? "self-start" : "self-end"}`}
            >
              {/* Message Bubble */}
              <div
                className={`rounded-[18px] px-4 py-2.5 text-[15px] leading-relaxed ${
                  isCustomer
                    ? "rounded-tl-[6px] bg-white text-foreground shadow-card"
                    : isDraft
                      ? "rounded-tr-[6px] bg-kept-soft text-[#134e4a] [outline:1.5px_dashed_#7dd3c8] [outline-offset:-1.5px]"
                      : isScheduled
                        ? "rounded-tr-[6px] bg-attention-soft text-[#7c2d12] [outline:1.5px_dashed_#f2c27b] [outline-offset:-1.5px]"
                        : isAiType
                          ? "rounded-tr-[6px] bg-kept text-white shadow-card"
                          : "rounded-tr-[6px] bg-ink text-white shadow-card"
                }`}
              >
                {editingId === message.id ? (
                  <div className="flex flex-col gap-2 min-w-[300px]">
                    <textarea
                      className="w-full resize-none rounded-[10px] border border-line-strong bg-white p-2.5 text-sm text-foreground focus:border-kept focus:shadow-[0_0_0_3px_rgb(13_148_136/0.15)] focus:outline-none"
                      rows={4}
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      autoFocus
                    />
                    <div className="flex gap-2 justify-end">
                      <Button variant="outline" size="sm" onClick={() => setEditingId(null)}>Cancel</Button>
                      <Button size="sm" onClick={() => handleSaveEdit(message.id)}>Save</Button>
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
                    <div className="w-fit self-end rounded-[10px] bg-attention-soft px-3 py-1.5 ring-1 ring-inset ring-[#f7dfb4]">
                      <CountdownTimer scheduledSendAt={message.scheduledSendAt} />
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex w-fit items-center gap-1.5 self-end">
                    <Button
                      variant="default"
                      size="sm"
                      className="bg-attention hover:bg-[#92400e]"
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
                        <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      ) : <ZapIcon />}
                      {isSending === message.id ? "Sending" : "Send now"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                     
                      onClick={() => { setEditingId(message.id); setEditContent(message.body); }}
                      disabled={isSending !== null}
                    >
                      <EditIcon /> Edit
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="!bg-lost-soft !text-lost hover:!bg-[#ffe4e8]"
                      onClick={() => onDiscardDraft && onDiscardDraft(message.id)}
                      disabled={isSending !== null}
                    >
                      <TrashIcon /> Discard
                    </Button>
                  </div>
                </div>
              )}

              {/* ======= DRAFT MESSAGE: Send/Edit/Discard buttons ======= */}
              {isDraft && editingId !== message.id && (
                <div className="mt-2 flex w-fit items-center gap-1.5 self-end">
                  <Button
                    variant="outline"
                    size="sm"
                   
                    onClick={() => { setEditingId(message.id); setEditContent(message.body); }}
                    disabled={isSending !== null}
                  >
                    <EditIcon /> Edit
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="!bg-lost-soft !text-lost hover:!bg-[#ffe4e8]"
                    onClick={() => onDiscardDraft && onDiscardDraft(message.id)}
                    disabled={isSending !== null}
                  >
                    <TrashIcon /> Discard
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                   
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
                      <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    ) : <SendIcon />}
                    {isSending === message.id ? "Sending" : "Send"}
                  </Button>
                </div>
              )}

              {/* ======= What the AI based this on, and the customer's return right ======= */}
              {isAiType && ((message.facts?.length ?? 0) > 0 || message.returnOptionStated) && (
                <div className="mt-1.5 flex max-w-full flex-wrap items-center justify-end gap-1.5 self-end text-[11px]">
                  {(message.facts?.length ?? 0) > 0 && (
                    <span className="rounded-full bg-white px-2 py-0.5 text-muted ring-1 ring-inset ring-line" title="The order data this answer used">
                      Based on: {message.facts!.join(" · ")}
                    </span>
                  )}
                  {message.returnOptionStated && (
                    <span className="rounded-full bg-kept-soft px-2 py-0.5 font-medium text-kept-strong" title="The customer was told they can still return it for a full refund">
                      Return option stated
                    </span>
                  )}
                </div>
              )}

              {/* ======= Sender label + timestamp ======= */}
              <div className={`flex items-center gap-1.5 mt-1 mx-1 text-[11px] font-medium text-faint ${isCustomer ? "justify-start" : "justify-end"}`}>
                {isAiType && (
                  <span className="flex items-center gap-1 text-kept">
                    <BotIconSmall />
                    {isScheduled ? "AI, scheduled" : isDraft ? "AI draft" : "AI"}
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
