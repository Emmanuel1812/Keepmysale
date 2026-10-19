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

export interface ConversationVisibilityInput {
  category?: string | null;
  isKnownCustomer?: boolean | null;
  lastMessageSenderType?: string | null;
}

/**
 * Is this conversation support work? False for mail the filter set aside, and for a sender who has
 * never ordered and whom nobody has answered yet (the product deliberately does not run the AI on
 * such mail). It stays reviewable under "Filtered"; as soon as someone replies, it counts.
 */
export function isSupportConversation(c: ConversationVisibilityInput): boolean {
  if (isNonSupportCategory(c.category)) return false;
  if (c.category != null && ACTIVE_CASE_CATEGORIES.includes(c.category)) return true;
  const strangerNobodyAnswered = c.isKnownCustomer === false && (c.lastMessageSenderType ?? "customer") === "customer";
  return !strangerNobodyAnswered;
}

/** Conversations whose last message is the customer's, i.e. waiting for an answer. */
export function countUnanswered(conversations: ReadonlyArray<ConversationVisibilityInput & { status?: string | null }>): number {
  return conversations.filter(
    (c) => c.status !== "resolved" && c.status !== "closed" && isSupportConversation(c) && c.lastMessageSenderType === "customer",
  ).length;
}
