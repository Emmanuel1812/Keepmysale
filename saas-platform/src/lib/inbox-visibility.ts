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
