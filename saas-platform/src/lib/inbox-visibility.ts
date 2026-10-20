/**
 * Which conversations are real customer support, and which are mail the filter set aside.
 *
 * The email filter and the webhook already label what it is not: `spam` (newsletters, automated
 * senders, bounces), `financial` (banks, payment providers) and `unknown` (a sender who has never
 * ordered). Those are kept, never deleted, and reviewable under the "Filtered" tab, but they are not
 * support work: they must not fill "All", the unread badge, or the dashboard numbers.
 */
export const NON_SUPPORT_CATEGORIES: readonly string[] = ["spam", "financial", "unknown"];

export function isNonSupportCategory(category: string | null | undefined): boolean {
  return category != null && NON_SUPPORT_CATEGORIES.includes(category);
}

/** Message senders that mean "the AI produced the answer" (a draft counts: pilots run draft-only). */
export const AI_RESPONSE_SENDERS: readonly string[] = ["ai", "ai_draft", "ai_scheduled"];

/** Categories where a person or the AI is actively working the case: never hidden, whoever the sender is. */
const ACTIVE_CASE_CATEGORIES: readonly string[] = [
  "human_required",
  "returns",
  "negotiation_active",
  "negotiation_accepted",
  "negotiation_rejected",
];

export interface ThreadMessage {
  conversationId: string;
  sender: string;
  createdAt: string;
}

export interface ThreadState {
  /** sender of the newest message, e.g. "customer" | "ai" | "ai_draft" | "human_agent" */
  lastSender: string | null;
  hasHumanReply: boolean;
}

/**
 * The conversations table has no "last sender" column (the app used to read a column that does not exist,
 * so it was always empty: the unread count never counted and the Drafts tab never filled). The messages are
 * the source of truth, so derive it from them.
 */
/**
 * Who really wrote last. Old rows saved while the `ai_draft` sender did not exist yet are sender "ai" with
 * is_fallback_draft: they were never sent, so the inbox must not call them "Answered by AI".
 */
export function effectiveSender(sender: string, isFallbackDraft: unknown): string {
  return sender === "ai" && (isFallbackDraft === true || isFallbackDraft === "true") ? "ai_draft" : sender;
}

export function deriveThreadStates(messages: ReadonlyArray<ThreadMessage>): Map<string, ThreadState> {
  const newestFirst = [...messages].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const states = new Map<string, ThreadState>();
  for (const m of newestFirst) {
    const state = states.get(m.conversationId) ?? { lastSender: m.sender, hasHumanReply: false };
    if (m.sender === "human_agent") state.hasHumanReply = true;
    states.set(m.conversationId, state);
  }
  return states;
}

export interface ConversationVisibilityInput {
  category?: string | null;
  isKnownCustomer?: boolean | null;
  lastMessageSenderType?: string | null;
  hasHumanReply?: boolean | null;
}

/**
 * Is this conversation support work?
 * - No for mail the filter set aside (spam / financial / unknown).
 * - Yes for an active case (return, negotiation, needs a human), whoever wrote it.
 * - Yes for a customer who has ordered.
 * - For a sender who never ordered: only once a PERSON has replied. An automated AI reply does not make it
 *   support: past versions answered Shopify notifications and marketing mail, and the product's own rule is
 *   not to run the AI on strangers.
 * It stays reviewable under "Filtered" either way; nothing is deleted.
 */
export function isSupportConversation(c: ConversationVisibilityInput): boolean {
  if (isNonSupportCategory(c.category)) return false;
  if (c.category != null && ACTIVE_CASE_CATEGORIES.includes(c.category)) return true;
  if (c.isKnownCustomer === false) return c.hasHumanReply === true;
  return true;
}

/** Support conversations whose newest message is the customer's: waiting for an answer. */
export function countUnanswered(conversations: ReadonlyArray<ConversationVisibilityInput & { status?: string | null }>): number {
  return conversations.filter(
    (c) => c.status !== "resolved" && c.status !== "closed" && isSupportConversation(c) && c.lastMessageSenderType === "customer",
  ).length;
}
