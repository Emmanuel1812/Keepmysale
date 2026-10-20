import type { GmailMessage } from "@/lib/gmail/client";
import type { FilterResult, ParsedEmail, EmailHeader } from "@/lib/services/email-filter";
import type { IIntentStructuredResult } from "@/types/ai";
import type { ActionResult } from "@/types/domain";
import type { IMerchantSettings } from "@/types/merchant";
import type { IOrder } from "@/types/order";
import { decideAutoReply } from "@/lib/automation/reply-policy";
import { extractCleanEmail, stripHtml } from "@/lib/email/parser";
import { buildOfferForStep, checkNegotiationEligibility } from "@/services/negotiation-service";
import { orderLabel } from "@/lib/order-label";
import type { ReplayItem, ReplayReturnCase } from "@/lib/replay/summary";

export { REPLAY_MAX_IDS_PER_REQUEST, summarizeReplay } from "@/lib/replay/summary";
export type { ReplayItem, ReplayOutcome, ReplayReturnCase, ReplaySummary } from "@/lib/replay/summary";

/**
 * Inbox replay: what Keepmysale WOULD have done with a merchant's recent customer mail.
 *
 * It runs the same filter, classification, send-or-draft policy and reply builder as the live pipeline, but it has no
 * way to send, store or label anything: every dependency it gets is a read or an AI call. That is the whole promise of
 * the feature ("nothing leaves your inbox"), so the tests check it.
 */

export interface ReplayDeps {
  settings: IMerchantSettings;
  /** The merchant's orders, already scoped to this merchant. */
  orders: IOrder[];
  filter: (email: ParsedEmail, headers: EmailHeader[]) => Promise<FilterResult>;
  classify: (text: string) => Promise<IIntentStructuredResult>;
  draft: (input: { text: string; intent: IIntentStructuredResult; customerName?: string }) => Promise<ActionResult>;
}

const QUOTE_PATTERNS = [
  /On .+ wrote:[\s\S]*/m,
  /Op .+ schreef.*:[\s\S]*/m,
  /Em .+ escreveu:[\s\S]*/m,
  /^>.*$/gm,
  /---------- Forwarded message[\s\S]*/m,
  /^-{2,}$/gm,
  /^Sent from my.*/im,
  /^Verzonden vanaf mijn.*/im,
];

export function cleanEmailBody(body: string): string {
  let cleaned = body || "";
  for (const pattern of QUOTE_PATTERNS) cleaned = cleaned.replace(pattern, "");
  return stripHtml(cleaned.trim()).trim();
}

const bareNumber = (value: string | null | undefined) => (value ?? "").replace(/^#+/, "").trim().toLowerCase();

/** The order a return request is about: the number the customer quoted, else their most recent order. */
export function findOrderForEmail(orders: IOrder[], email: string, orderNumber: string | null): IOrder | null {
  if (orderNumber) {
    const wanted = bareNumber(orderNumber);
    const byNumber = orders.find((o) => bareNumber(o.shopifyOrderNumber) === wanted);
    if (byNumber) return byNumber;
  }
  const mine = orders
    .filter((o) => (o.email ?? "").toLowerCase() === email.toLowerCase())
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  return mine[0] ?? null;
}

function returnCaseFor(order: IOrder | null, settings: IMerchantSettings): ReplayReturnCase {
  if (!order) {
    return {
      orderLabel: null, orderValue: null, currency: null, eligible: false, reason: "no_matching_order",
      firstOfferPercentage: null, firstOfferType: null, keptIfAccepted: null,
    };
  }
  const value = Number(order.totalPrice) || 0;
  const base = { orderLabel: orderLabel(order.shopifyOrderNumber, order.id), orderValue: value, currency: order.currency };
  if (settings.auto_negotiate === false) {
    return { ...base, eligible: false, reason: "negotiation_off", firstOfferPercentage: null, firstOfferType: null, keptIfAccepted: null };
  }
  const eligibility = checkNegotiationEligibility(
    value,
    (order.lineItems as Array<{ title?: string; product_type?: string; category?: string }>) ?? null,
    settings,
  );
  if (!eligibility.eligible) {
    return { ...base, eligible: false, reason: eligibility.reason, firstOfferPercentage: null, firstOfferType: null, keptIfAccepted: null };
  }
  const offer = buildOfferForStep(1, value, order.currency, settings);
  return {
    ...base,
    eligible: true,
    firstOfferPercentage: offer.percentage ?? null,
    firstOfferType: offer.type,
    keptIfAccepted: Number((value - offer.amount).toFixed(2)),
  };
}

export async function analyzeEmail(email: GmailMessage, deps: ReplayDeps): Promise<ReplayItem> {
  const from = extractCleanEmail(email.from);
  const body = cleanEmailBody(email.body);
  const base: ReplayItem = {
    id: email.id,
    from,
    subject: email.subject,
    receivedAt: email.receivedAt ?? null,
    snippet: body.slice(0, 280),
    outcome: "filtered",
  };

  const filtered = await deps.filter({ id: email.id, from: email.from, subject: email.subject, body }, email.headers ?? []);
  if (!filtered.shouldProcess) return { ...base, outcome: "filtered", reason: filtered.reason };

  const blockedSubject = (deps.settings.do_not_engage_subjects ?? []).find((s) =>
    (email.subject || "").toLowerCase().includes(s.toLowerCase()),
  );
  if (blockedSubject) return { ...base, outcome: "filtered", reason: `do_not_engage: ${blockedSubject}` };

  // Same rule as live: the AI does not run on people who never ordered
  const isKnownCustomer = deps.orders.some((o) => (o.email ?? "").toLowerCase() === from.toLowerCase());
  if (!isKnownCustomer) return { ...base, outcome: "not_customer" };

  try {
    const intent = await deps.classify(body);
    const decision = decideAutoReply(intent, deps.settings);
    const action = await deps.draft({ text: body, intent });
    const item: ReplayItem = {
      ...base,
      // Same rule as live: a reply about an order it could not find is a draft, not an automatic answer
      outcome: decision.skipAutoReply || action.grounded === false ? "draft" : "auto_reply",
      facts: action.facts ?? [],
      intent: intent.intent,
      confidence: intent.confidence,
      reply: action.messageBody,
    };
    if (intent.intent === "return") {
      item.returnCase = returnCaseFor(findOrderForEmail(deps.orders, from, intent.extracted_order_number), deps.settings);
    }
    return item;
  } catch (error) {
    return { ...base, outcome: "error", reason: error instanceof Error ? error.message : "analysis_failed" };
  }
}
