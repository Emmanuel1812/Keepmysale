/**
 * Every keep-it offer must leave the customer's legal right intact and say so: in the EU a consumer may withdraw
 * from an online purchase and get the full price back, and the Dutch ACM fines shops that steer customers away from
 * their refund (500,000 EUR for webshop TOM). So an offer always ends with the plain return option, whatever the AI
 * wrote. Deterministic on purpose: this is the one sentence that must never depend on a model.
 */
const RETURN_OPTION: Record<string, string> = {
  nl: "Liever terugsturen? Dat kan altijd. Laat het ons weten, dan betalen we het volledige aankoopbedrag terug.",
  en: "Would you rather send it back? That is always possible. Just tell us and we refund the full purchase price.",
  pt: "Prefere devolver? É sempre possível. Diga-nos e reembolsamos o valor total da compra.",
};

const MENTIONS_RETURN = /(terugstur|retourner|retour|send it back|return it|devolv)/i;
const MENTIONS_FULL = /(volledig|full|total|integral)/i;

export function statesReturnOption(message: string): boolean {
  return MENTIONS_RETURN.test(message) && MENTIONS_FULL.test(message);
}

export function ensureReturnOption(message: string, language: string): { message: string; added: boolean } {
  if (statesReturnOption(message)) return { message, added: false };
  const sentence = RETURN_OPTION[language] ?? RETURN_OPTION.nl;
  return { message: `${message.trimEnd()}\n\n${sentence}`, added: true };
}

/** An offer of a partial refund or store credit that the customer still has to answer. */
export function isOpenOffer(action: { action: string; negotiationDecision?: string }, message: string): boolean {
  if (action.action !== "offer_partial_refund") return false;
  if (action.negotiationDecision === "accept" || action.negotiationDecision === "reject") return false;
  return /\d{1,2}\s*(%|procent|percent)/i.test(message);
}
