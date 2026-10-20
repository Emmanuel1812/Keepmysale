/**
 * Exchange first: when a customer wants to return something because of the size, offer a size that is in stock
 * before any partial refund. An exchange keeps 100% of the sale; a 20% keep-it offer keeps 80%.
 *
 * Pure decisions only (no I/O): what the reason is, which line item it is about, which sizes are in stock, what
 * the customer chose. ExchangeService does the Shopify and database work.
 */

export type ExchangeMode = "off" | "suggest" | "automatic";

export interface ExchangeOption {
  variantId: string;
  label: string;
}

export interface ExchangeState {
  status: "offered" | "requested" | "created" | "declined" | "failed" | "done";
  orderId: string;
  orderLabel: string;
  lineItem: { title: string; variantId: string | null; productId: string | null; variantTitle: string | null };
  options: ExchangeOption[];
  /** false when we could not read stock: the reply then must not say "in stock" */
  stockKnown: boolean;
  reason: "SIZE_TOO_SMALL" | "SIZE_TOO_LARGE" | "OTHER";
  chosen?: ExchangeOption;
  shopifyReturnId?: string;
  error?: string;
  updatedAt: string;
}

export interface VariantInfo {
  id: string;
  title: string;
  options: string[];
  inventoryQuantity: number | null;
  inventoryManagement: string | null;
  inventoryPolicy: string | null;
}

const SIZE_WORDS = /(te klein|te groot|te krap|te ruim|maat|past niet|valt (klein|groot|ruim)|kleinere|grotere|size|too (small|big|large|tight|loose)|doesn'?t fit|does not fit|smaller|bigger|larger)/i;
const TOO_SMALL = /(te klein|te krap|valt klein|grotere|too (small|tight)|bigger|larger)/i;
const TOO_LARGE = /(te groot|te ruim|valt (groot|ruim)|kleinere|too (big|large|loose)|smaller)/i;

export function isSizeReason(text: string): boolean {
  return SIZE_WORDS.test(text);
}

export function sizeReason(text: string): ExchangeState["reason"] {
  if (TOO_SMALL.test(text)) return "SIZE_TOO_SMALL";
  if (TOO_LARGE.test(text)) return "SIZE_TOO_LARGE";
  return "OTHER";
}

/** The line item the customer means: the one named in the message, else the only one. */
export function pickLineItem(
  lineItems: Array<Record<string, unknown>>,
  text: string,
): Record<string, unknown> | null {
  const items = lineItems.filter((item) => item && (item.variant_id || item.product_id));
  if (items.length === 1) return items[0];
  const lower = text.toLowerCase();
  const named = items.filter((item) => {
    const title = String(item.title ?? item.name ?? "").toLowerCase();
    return title.length > 2 && lower.includes(title);
  });
  return named.length === 1 ? named[0] : null;
}

export function isInStock(variant: VariantInfo): boolean {
  if (variant.inventoryPolicy === "continue") return true; // the shop sells it when out of stock
  if (!variant.inventoryManagement) return true; // stock is not tracked
  if (variant.inventoryManagement === "unknown") return true; // we could not read stock (the reply says so)
  return (variant.inventoryQuantity ?? 0) > 0;
}

/** Other sizes of the same product that can actually be sent. */
export function alternativeOptions(variants: VariantInfo[], currentVariantId: string | null): ExchangeOption[] {
  return variants
    .filter((variant) => String(variant.id) !== String(currentVariantId ?? "") && isInStock(variant))
    .map((variant) => ({ variantId: String(variant.id), label: variant.title }))
    .filter((option) => option.label && option.label.toLowerCase() !== "default title")
    .slice(0, 6);
}

const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** The option the customer picked, when exactly one matches ("maat M", "doe maar 42", "Large please"). */
export function matchChoice(text: string, options: ExchangeOption[]): ExchangeOption | null {
  const hits = options.filter((option) => {
    const parts = option.label.split(/\s*\/\s*/).filter(Boolean);
    return parts.some((part) => new RegExp(`(^|[^\\p{L}\\p{N}])${escape(part)}($|[^\\p{L}\\p{N}])`, "iu").test(text));
  });
  return hits.length === 1 ? hits[0] : null;
}

const DECLINE = /(\bnee\b|geen ruil|niet ruilen|liever (mijn )?geld|geld terug|terugbetal|refund|\bno\b|money back|rather (not|return))/i;

export function isDecline(text: string): boolean {
  return DECLINE.test(text);
}

type Lang = "nl" | "en";
const lang = (language: string): Lang => (language === "en" ? "en" : "nl");
const list = (options: ExchangeOption[]) => options.map((o) => o.label).join(", ");

export function offerMessage(state: Pick<ExchangeState, "lineItem" | "options"> & { stockKnown?: boolean }, language: string): string {
  const item = state.lineItem.title;
  const known = state.stockKnown !== false;
  if (lang(language) === "en") {
    return `Sorry the ${item} does not fit. Would you like to swap it for another size? ${known ? `These are in stock: ${list(state.options)}.` : `It comes in ${list(state.options)}; we check stock as soon as you tell us.`} Tell us which one and we will arrange the exchange.\n\nWould you rather send it back? That is always possible. Just tell us and we refund the full purchase price.`;
  }
  return `Jammer dat de ${item} niet goed past. Wil je hem ruilen voor een andere maat? ${known ? `Deze hebben we op voorraad: ${list(state.options)}.` : `Hij is er ook in ${list(state.options)}; we checken de voorraad zodra je het laat weten.`} Laat ons weten welke je wilt, dan regelen we de ruil.\n\nLiever terugsturen? Dat kan altijd. Laat het ons weten, dan betalen we het volledige aankoopbedrag terug.`;
}

export function askAgainMessage(state: Pick<ExchangeState, "options">, language: string): string {
  if (lang(language) === "en") {
    return `Which size would you like? We have ${list(state.options)} in stock. If you would rather return it for a refund, just say so.`;
  }
  return `Welke maat wil je? We hebben ${list(state.options)} op voorraad. Wil je het toch liever terugsturen voor je geld terug, laat het ons dan weten.`;
}

export function confirmMessage(state: Pick<ExchangeState, "lineItem" | "chosen" | "status">, language: string, storeName: string): string {
  const item = state.lineItem.title;
  const size = state.chosen?.label ?? "";
  if (lang(language) === "en") {
    return state.status === "created"
      ? `Done: we have set up the exchange of your ${item} for ${size}. You will receive an email from ${storeName} with the return instructions. As soon as your return is on its way, we send the new size.`
      : `Great, we will exchange your ${item} for ${size}. You will receive the return instructions from us shortly. As soon as your return is on its way, we send the new size.`;
  }
  return state.status === "created"
    ? `Geregeld: we hebben de ruil van je ${item} voor ${size} aangemaakt. Je krijgt een e-mail van ${storeName} met de retourinstructies. Zodra je retour onderweg is, sturen we de nieuwe maat.`
    : `Top, we ruilen je ${item} voor ${size}. Je krijgt zo snel mogelijk de retourinstructies van ons. Zodra je retour onderweg is, sturen we de nieuwe maat.`;
}
