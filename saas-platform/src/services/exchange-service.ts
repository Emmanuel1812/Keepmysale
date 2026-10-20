import {
  alternativeOptions,
  askAgainMessage,
  confirmMessage,
  isDecline,
  isSizeReason,
  matchChoice,
  offerMessage,
  pickLineItem,
  sizeReason,
  type ExchangeMode,
  type ExchangeState,
  type VariantInfo,
} from "@/lib/automation/exchange";
import { orderLabel } from "@/lib/order-label";
import type { IOrder } from "@/types/order";

export interface ExchangeDeps {
  loadVariants: (productId: string) => Promise<{ variants: VariantInfo[]; stockKnown: boolean }>;
  /** Shopify returnCreate with an exchange line item (automatic mode only). */
  createReturn: (input: { orderId: string; returnVariantId: string; exchangeVariantId: string; reason: ExchangeState["reason"] }) => Promise<{ returnId: string }>;
  /** Whether this shop granted read_returns + write_returns. */
  canCreateReturns: () => Promise<boolean>;
}

export interface ExchangeDecision {
  /** null: no reply from the exchange flow (e.g. the customer declined; the normal flow answers instead) */
  messageBody: string | null;
  state: ExchangeState;
  facts: string[];
}

/**
 * The exchange conversation, one customer message at a time, with its state kept on the conversation
 * (conversation.metadata.exchange): offered → requested (merchant handles it) / created (made in Shopify) /
 * declined (back to the normal return offers) / failed.
 */
export class ExchangeService {
  constructor(private readonly deps: ExchangeDeps) {}

  async decide(input: {
    mode: ExchangeMode;
    text: string;
    intent: string;
    existing?: ExchangeState | null;
    order: IOrder | null;
    language: string;
    storeName: string;
    now?: string;
  }): Promise<ExchangeDecision | null> {
    if (input.mode === "off") return null;
    const now = input.now ?? new Date().toISOString();
    const existing = input.existing ?? null;

    // A follow-up to an exchange we offered
    if (existing?.status === "offered") {
      const chosen = existing.options.length ? matchChoice(input.text, existing.options) : null;

      if (!chosen && isDecline(input.text)) {
        return { messageBody: null, state: { ...existing, status: "declined", updatedAt: now }, facts: [] };
      }
      if (!chosen) {
        return { messageBody: askAgainMessage(existing, input.language), state: { ...existing, updatedAt: now }, facts: this.facts(existing) };
      }

      let state: ExchangeState = { ...existing, chosen, status: "requested", updatedAt: now };
      if (input.mode === "automatic" && existing.lineItem.variantId && (await this.deps.canCreateReturns())) {
        try {
          const { returnId } = await this.deps.createReturn({
            orderId: existing.orderId,
            returnVariantId: existing.lineItem.variantId,
            exchangeVariantId: chosen.variantId,
            reason: existing.reason,
          });
          state = { ...state, status: "created", shopifyReturnId: returnId };
        } catch (error) {
          // The customer still gets a correct answer; the merchant sees the request and why it was not created
          state = { ...state, status: "requested", error: error instanceof Error ? error.message : "create_failed" };
        }
      }
      return { messageBody: confirmMessage(state, input.language, input.storeName), state, facts: this.facts(state) };
    }

    // Already handled (requested, created, declined, failed): the normal flow answers
    if (existing) return null;

    // A new return because of the size
    if (!["return", "exchange"].includes(input.intent) || !isSizeReason(input.text) || !input.order) return null;
    const item = pickLineItem((input.order.lineItems ?? []) as Array<Record<string, unknown>>, input.text);
    const productId = item?.product_id != null ? String(item.product_id) : null;
    if (!item || !productId) return null;

    const variantId = item.variant_id != null ? String(item.variant_id) : null;
    const { variants, stockKnown } = await this.deps.loadVariants(productId);
    const options = alternativeOptions(variants, variantId);
    if (options.length === 0) return null; // nothing to swap to: the normal offers apply

    const state: ExchangeState = {
      status: "offered",
      orderId: input.order.shopifyOrderId,
      orderLabel: orderLabel(input.order.shopifyOrderNumber, input.order.id),
      lineItem: {
        title: String(item.title ?? item.name ?? "item"),
        variantId,
        productId,
        variantTitle: item.variant_title != null ? String(item.variant_title) : null,
      },
      options,
      stockKnown,
      reason: sizeReason(input.text),
      updatedAt: now,
    };
    return { messageBody: offerMessage(state, input.language), state, facts: this.facts(state) };
  }

  private facts(state: ExchangeState): string[] {
    return [
      `Order ${state.orderLabel}`,
      `${state.lineItem.title}${state.lineItem.variantTitle ? ` (${state.lineItem.variantTitle})` : ""}`,
      state.chosen ? `Ruil naar ${state.chosen.label}` : `${state.stockKnown ? "Op voorraad" : "Maten"}: ${state.options.map((o) => o.label).join(", ")}`,
    ];
  }
}
