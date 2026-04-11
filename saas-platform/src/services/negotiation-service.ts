import type { SupabaseClient } from "@supabase/supabase-js";
import type { INegotiation, INegotiationOffer, TNegotiationStatus } from "@/types/negotiation";
import type { INegotiationCreate, INegotiationUpdate } from "@/types/negotiation";
import type { IMerchantSettings } from "@/types/merchant";
import { NEGOTIATION_MAX_STEPS } from "@/lib/constants";
import { NegotiationsDal } from "@/dal/negotiations";
import { RefundLogsDal } from "@/dal/refund-logs";
import { OrdersDal } from "@/dal/orders";
import { ConversationsDal } from "@/dal/conversations";
import { RefundService } from "@/services/refund-service";

export type TCustomerNegotiationInput =
  | "accept_offer"
  | "reject_offer"
  | "no_response_timeout"
  | "request_full_return";

export interface INegotiationTransitionResult {
  nextStatus: TNegotiationStatus;
  nextStep: number;
  shouldCreateRefundLog: boolean;
  refundLogAction:
    | "partial_refund_offered"
    | "partial_refund_accepted"
    | "return_initiated"
    | "escalated"
    | "offer_rejected"
    | null;
}

export function buildOfferForStep(
  step: number,
  orderAmount: number,
  currency = "EUR",
  merchantSettings?: IMerchantSettings,
): INegotiationOffer {
  const configured = merchantSettings?.negotiation_offers?.find((item) => item.step === step);
  const percentage = configured?.percentage ?? { 1: 20, 2: 35, 3: 50 }[step] ?? 50;
  const amount = Number(((orderAmount * percentage) / 100).toFixed(2));
  return {
    step,
    type: configured?.type ?? (step === 3 ? "store_credit" : "partial_refund"),
    percentage,
    amount,
    currency,
    offered_at: new Date().toISOString(),
    response: "pending",
  };
}

export function transitionNegotiationState(
  current: INegotiation,
  input: TCustomerNegotiationInput,
): INegotiationTransitionResult {
  if (input === "request_full_return") {
    return {
      nextStatus: "return_initiated",
      nextStep: current.currentStep,
      shouldCreateRefundLog: true,
      refundLogAction: "return_initiated",
    };
  }

  if (input === "accept_offer") {
    return {
      nextStatus: "offer_accepted",
      nextStep: current.currentStep,
      shouldCreateRefundLog: true,
      refundLogAction: "partial_refund_accepted",
    };
  }

  if (input === "no_response_timeout") {
    return {
      nextStatus: "escalated",
      nextStep: current.currentStep,
      shouldCreateRefundLog: true,
      refundLogAction: "escalated",
    };
  }

  const hasMoreSteps = current.currentStep < (current.maxSteps || NEGOTIATION_MAX_STEPS);
  if (hasMoreSteps) {
    return {
      nextStatus: "offer_sent",
      nextStep: current.currentStep + 1,
      shouldCreateRefundLog: true,
      refundLogAction: "offer_rejected",
    };
  }

  return {
    nextStatus: "return_initiated",
    nextStep: current.currentStep,
    shouldCreateRefundLog: true,
    refundLogAction: "return_initiated",
  };
}

export class NegotiationService {
  private readonly negotiationsDal: NegotiationsDal;
  private readonly refundLogsDal: RefundLogsDal;
  private readonly ordersDal: OrdersDal;
  private readonly conversationsDal: ConversationsDal;
  private readonly refundService: RefundService;

  constructor(private readonly supabase: SupabaseClient) {
    this.negotiationsDal = new NegotiationsDal(supabase);
    this.refundLogsDal = new RefundLogsDal(supabase);
    this.ordersDal = new OrdersDal(supabase);
    this.conversationsDal = new ConversationsDal(supabase);
    this.refundService = new RefundService(supabase);
  }

  findById(id: string) {
    return this.negotiationsDal.findById(id);
  }

  findByMerchant(merchantId: string) {
    return this.negotiationsDal.findByMerchant(merchantId);
  }

  findByConversation(conversationId: string) {
    return this.negotiationsDal.findByConversation(conversationId);
  }

  findActiveByOrder(orderId: string) {
    return this.negotiationsDal.findActiveByOrder(orderId);
  }

  findActiveByCustomer(merchantId: string, customerId: string) {
    return this.negotiationsDal.findActiveByCustomer(merchantId, customerId);
  }

  create(input: INegotiationCreate) {
    return this.negotiationsDal.create(input);
  }

  update(id: string, input: INegotiationUpdate) {
    return this.negotiationsDal.update(id, input);
  }

  delete(id: string) {
    return this.negotiationsDal.delete(id);
  }

  updateStatus(id: string, status: TNegotiationStatus) {
    return this.negotiationsDal.updateStatus(id, status);
  }

  addOffer(id: string, offer: INegotiationOffer) {
    return this.negotiationsDal.addOffer(id, offer);
  }

  async initiateNegotiation(
    merchantId: string,
    conversationId: string,
    customerId: string,
    orderId: string,
    merchantSettings: IMerchantSettings,
  ): Promise<INegotiation> {
    const activeForOrder = await this.negotiationsDal.findActiveByOrder(orderId);
    if (activeForOrder.length > 0) {
      return activeForOrder[0];
    }

    const created = await this.negotiationsDal.create({
      merchantId,
      conversationId,
      customerId,
      orderId,
      status: "initiated",
      currentStep: 0,
      maxSteps: merchantSettings.negotiation_offers.length || NEGOTIATION_MAX_STEPS,
      offers: [],
    });

    const order = await this.ordersDal.findById(orderId);
    const orderAmount = Number(order?.totalPrice ?? 0) || 0;
    const firstOffer = buildOfferForStep(1, orderAmount, order?.currency ?? "EUR", merchantSettings);
    const withOffer = await this.negotiationsDal.addOffer(created.id, firstOffer);
    const updated = await this.negotiationsDal.updateStatus(withOffer.id, "offer_sent");

    await this.refundLogsDal.create({
      merchantId,
      negotiationId: updated.id,
      orderId: orderId,
      customerId,
      action: "partial_refund_offered",
      amount: firstOffer.amount,
      currency: firstOffer.currency,
      customerConsentRecorded: false,
      auditDetails: {
        step: firstOffer.step,
        type: firstOffer.type,
        percentage: firstOffer.percentage ?? null,
      },
    });

    return updated;
  }

  async processCustomerResponse(
    negotiationId: string,
    customerInput: "accept_offer" | "reject_offer" | "request_full_return",
    merchantSettings: IMerchantSettings,
  ): Promise<INegotiation> {
    const current = await this.negotiationsDal.findById(negotiationId);
    if (!current) {
      throw new Error("Negotiation not found");
    }

    const transition = transitionNegotiationState(current, customerInput);
    let working = current;

    if (transition.nextStep > current.currentStep) {
      const order = current.orderId ? await this.ordersDal.findById(current.orderId) : null;
      const baseAmount = Number(order?.totalPrice ?? 0) || 0;
      const nextOffer = buildOfferForStep(
        transition.nextStep,
        baseAmount,
        order?.currency ?? "EUR",
        merchantSettings,
      );
      working = await this.negotiationsDal.addOffer(current.id, nextOffer);
      await this.refundLogsDal.create({
        merchantId: working.merchantId,
        negotiationId: working.id,
        orderId: working.orderId,
        customerId: working.customerId,
        action: "partial_refund_offered",
        amount: nextOffer.amount,
        currency: nextOffer.currency,
        customerConsentRecorded: false,
        auditDetails: { step: nextOffer.step, response_to_previous: "rejected" },
      });
    }

    let updated = await this.negotiationsDal.updateStatus(working.id, transition.nextStatus);

    if (transition.nextStatus === "offer_accepted" || transition.nextStatus === "completed") {
      const acceptedOffer = [...updated.offers].reverse().find((offer) => offer.response === "pending");
      const finalRefundAmount = acceptedOffer?.amount ?? null;
      const estimatedReturnCost = updated.estimatedReturnCost ?? 0;
      const productCost = updated.productCost ?? 0;
      const savings =
        finalRefundAmount === null ? null : Number((productCost + estimatedReturnCost - finalRefundAmount).toFixed(2));

      updated = await this.negotiationsDal.update(updated.id, {
        finalRefundAmount,
        finalRefundType: acceptedOffer?.type ?? "partial_refund",
        savings,
        completedAt: transition.nextStatus === "completed" ? new Date().toISOString() : null,
      });

      // Automatic refund execution removed here. Now handled manually via UI.
    }

    if (transition.nextStatus === "return_initiated") {
      updated = await this.negotiationsDal.update(updated.id, {
        finalRefundType: "full_refund",
      });
    }

    if (transition.shouldCreateRefundLog && transition.refundLogAction && transition.nextStatus !== "completed") {
      const order = updated.orderId ? await this.ordersDal.findById(updated.orderId) : null;
      await this.refundLogsDal.create({
        merchantId: updated.merchantId,
        negotiationId: updated.id,
        orderId: updated.orderId,
        customerId: updated.customerId,
        action: transition.refundLogAction,
        amount: updated.finalRefundAmount,
        currency: order?.currency ?? "EUR",
        customerConsentRecorded: customerInput === "accept_offer",
        auditDetails: {
          from_status: current.status,
          to_status: transition.nextStatus,
          customer_input: customerInput,
        },
      });
    }

    if (transition.nextStatus === "completed" || transition.nextStatus === "return_initiated" || transition.nextStatus === "offer_accepted") {
      await this.conversationsDal.update(updated.conversationId, {
        status: "resolved",
        resolvedAt: new Date().toISOString(),
      });
    }

    return updated;
  }

  async finalizeRefund(id: string): Promise<INegotiation> {
    const negotiation = await this.negotiationsDal.findById(id);
    if (!negotiation) throw new Error("Negotiation not found");
    if (negotiation.status !== "offer_accepted") {
      throw new Error(`Refund can only be finalized for 'offer_accepted' negotiations (current: ${negotiation.status})`);
    }

    // Execute the actual Shopify refund
    await this.refundService.executeRefund(id);

    // Update status to completed and set completedAt
    const updated = await this.negotiationsDal.update(id, {
      status: "completed",
      completedAt: new Date().toISOString(),
    });

    return updated;
  }
}
