import { dominantCurrency } from "@/lib/money";

/** Shared by the replay service (server) and the replay page (browser): types and arithmetic only, no I/O. */

/** Ids per analyze request: each mail is up to two AI calls, and one request must finish inside the function limit. */
export const REPLAY_MAX_IDS_PER_REQUEST = 3;

export type ReplayOutcome = "filtered" | "not_customer" | "auto_reply" | "draft" | "error";

export interface ReplayReturnCase {
  orderLabel: string | null;
  orderValue: number | null;
  currency: string | null;
  /** The merchant's own rules (minimum order value, excluded products, negotiation switched off) allow an offer. */
  eligible: boolean;
  reason?: string;
  firstOfferPercentage: number | null;
  firstOfferType: string | null;
  /** What the merchant keeps if the customer takes the first offer instead of returning: order value minus the refund. */
  keptIfAccepted: number | null;
}

export interface ReplayItem {
  id: string;
  from: string;
  subject: string;
  receivedAt: string | null;
  snippet: string;
  outcome: ReplayOutcome;
  reason?: string;
  intent?: string;
  confidence?: number;
  reply?: string;
  /** The order facts the answer was built on. */
  facts?: string[];
  returnCase?: ReplayReturnCase;
}

export interface ReplaySummary {
  total: number;
  filtered: number;
  notCustomer: number;
  autoReplies: number;
  drafts: number;
  errors: number;
  returnRequests: number;
  /** Return requests with an order the merchant's rules allow an offer on. */
  eligibleReturns: number;
  currency: string;
  /** Order value of the eligible return requests (in `currency`). */
  valueAtStake: number;
  /** Kept if every eligible customer took the first offer. An upper bound, not a forecast. */
  keptIfAllAccept: number;
  /** Kept at the given acceptance rate. */
  expectedKept: number;
  acceptanceRate: number;
}

/** `fallbackCurrency`: the store's own currency, shown when no return request names one. */
export function summarizeReplay(items: ReplayItem[], acceptanceRate: number, fallbackCurrency = "EUR"): ReplaySummary {
  const rate = Math.min(Math.max(acceptanceRate, 0), 1);
  const returns = items.filter((i) => i.returnCase);
  const eligible = returns.filter((i) => i.returnCase!.eligible);
  const currency = dominantCurrency(eligible.map((i) => i.returnCase!.currency), fallbackCurrency);
  const inCurrency = eligible.filter((i) => (i.returnCase!.currency ?? "").toUpperCase() === currency);
  const round = (n: number) => Number(n.toFixed(2));
  const valueAtStake = round(inCurrency.reduce((sum, i) => sum + (i.returnCase!.orderValue ?? 0), 0));
  const keptIfAllAccept = round(inCurrency.reduce((sum, i) => sum + (i.returnCase!.keptIfAccepted ?? 0), 0));

  return {
    total: items.length,
    filtered: items.filter((i) => i.outcome === "filtered").length,
    notCustomer: items.filter((i) => i.outcome === "not_customer").length,
    autoReplies: items.filter((i) => i.outcome === "auto_reply").length,
    drafts: items.filter((i) => i.outcome === "draft").length,
    errors: items.filter((i) => i.outcome === "error").length,
    returnRequests: returns.length,
    eligibleReturns: eligible.length,
    currency,
    valueAtStake,
    keptIfAllAccept,
    expectedKept: round(keptIfAllAccept * rate),
    acceptanceRate: rate,
  };
}
