/**
 * "Did the customer just accept the offer?" decided WITHOUT the AI, so it must be conservative.
 *
 * It used to match any message containing "ja", "ok", "graag", "wil ik"... anywhere. A new return request,
 * "Ik wil hem graag retourneren en mijn geld terug", was read as accepting a 50% offer from months earlier
 * and the customer was told the refund was confirmed. Now only a SHORT reply that says yes, and does not ask to
 * return or get money back, counts; everything else goes to the AI (or to the next offer).
 */
const YES = [
  /\bja\b/i, /\bjazeker\b/i, /\bok[eé]?\b/i, /\bakkoord\b/i, /\bprima\b/i, /\bdoe maar\b/i, /\bis goed\b/i,
  /\bgoed zo\b/i, /\baccepteer\b/i, /\bdeal\b/i, /\bgraag\b/i, /\bwil ik\b/i, /\bdoe het\b/i,
  /\byes\b/i, /\baccept\b/i, /\bsure\b/i, /\bfine\b/i, /\bsounds good\b/i, /\bi'?ll take it\b/i,
];

const NOT_ACCEPTING = [
  /retour/i, /terugsturen/i, /terug ?sturen/i, /geld terug/i, /terugbetal/i, /volledig/i, /\bniet\b/i, /\bgeen\b/i,
  /\bnee\b/i, /\bliever\b/i, /\breturn/i, /\brefund/i, /\bfull\b/i, /\bnot\b/i, /\bno\b/i, /\brather\b/i,
];

export const MAX_ACCEPTANCE_WORDS = 12;

export function isClearAcceptance(text: string): boolean {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return false;
  if (cleaned.split(" ").length > MAX_ACCEPTANCE_WORDS) return false;
  if (NOT_ACCEPTING.some((p) => p.test(cleaned))) return false;
  return YES.some((p) => p.test(cleaned));
}

/** Offers older than this are not "the current offer" any more; a new message starts a new conversation turn. */
export const OFFER_MEMORY_DAYS = 14;

export function withinOfferMemory(createdAt: string | null | undefined, now = Date.now()): boolean {
  if (!createdAt) return true;
  const t = new Date(createdAt).getTime();
  return !Number.isFinite(t) || now - t <= OFFER_MEMORY_DAYS * 24 * 60 * 60 * 1000;
}
