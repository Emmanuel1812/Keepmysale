import type { SupabaseClient } from "@supabase/supabase-js";
import type { IRefundLog, IRefundLogCreate, IRefundLogUpdate } from "@/types";
import { RefundLogsDal } from "@/dal/refund-logs";
import { NegotiationsDal } from "@/dal/negotiations";
import { OrdersDal } from "@/dal/orders";
import { MerchantService } from "@/services/merchant-service";
import { decryptAes256 } from "@/lib/encryption";
import { createRefund } from "@/lib/shopify/client";

export class RefundService {
  private readonly refundLogsDal: RefundLogsDal;
  private readonly negotiationsDal: NegotiationsDal;
  private readonly ordersDal: OrdersDal;
  private readonly merchantService: MerchantService;

  constructor(private readonly supabase: SupabaseClient) {
    this.refundLogsDal = new RefundLogsDal(supabase);
    this.negotiationsDal = new NegotiationsDal(supabase);
    this.ordersDal = new OrdersDal(supabase);
    this.merchantService = new MerchantService(supabase);
  }

  findById(id: string): Promise<IRefundLog | null> {
    return this.refundLogsDal.findById(id);
  }

  findByMerchant(merchantId: string): Promise<IRefundLog[]> {
    return this.refundLogsDal.findByMerchant(merchantId);
  }

  create(input: IRefundLogCreate): Promise<IRefundLog> {
    return this.refundLogsDal.create(input);
  }

  update(id: string, input: IRefundLogUpdate): Promise<IRefundLog> {
    return this.refundLogsDal.update(id, input);
  }

  delete(id: string): Promise<void> {
    return this.refundLogsDal.delete(id);
  }

  async executeRefund(negotiationId: string): Promise<void> {
    const negotiation = await this.negotiationsDal.findById(negotiationId);
    if (!negotiation) {
      throw new Error("Negotiation not found");
    }
    if (negotiation.status !== "completed") {
      throw new Error("Negotiation must be completed before refund execution");
    }
    if (!negotiation.orderId) {
      throw new Error("Negotiation has no order");
    }
    if (!negotiation.finalRefundAmount || !negotiation.finalRefundType) {
      throw new Error("Missing final refund details");
    }

    const order = await this.ordersDal.findById(negotiation.orderId);
    if (!order) {
      throw new Error("Order not found");
    }

    const merchant = await this.merchantService.findById(negotiation.merchantId);
    if (!merchant) {
      throw new Error("Merchant not found");
    }
    if (!merchant.shopifyAccessTokenEncrypted) {
      throw new Error("Missing encrypted Shopify token");
    }

    const accessToken = decryptAes256(merchant.shopifyAccessTokenEncrypted);
    const refundResult = await createRefund({
      shopDomain: merchant.shopDomain,
      accessToken,
      orderId: order.shopifyOrderId,
      amount: negotiation.finalRefundAmount,
      currency: order.currency ?? "EUR",
    });

    await this.negotiationsDal.update(negotiation.id, {
      shopifyRefundId: refundResult.refundId,
    });

    const action =
      negotiation.finalRefundType === "store_credit"
        ? "store_credit_issued"
        : negotiation.finalRefundType === "full_refund"
          ? "full_refund_processed"
          : "partial_refund_accepted";

    await this.refundLogsDal.create({
      merchantId: negotiation.merchantId,
      negotiationId: negotiation.id,
      orderId: negotiation.orderId,
      customerId: negotiation.customerId,
      action,
      amount: negotiation.finalRefundAmount,
      currency: order.currency ?? "EUR",
      shopifyRefundId: refundResult.refundId,
      shopifyTransactionId: refundResult.transactionId,
      customerConsentRecorded: true,
      auditDetails: {
        source: "shopify_refund_execution",
        final_refund_type: negotiation.finalRefundType,
      },
    });
  }
}
