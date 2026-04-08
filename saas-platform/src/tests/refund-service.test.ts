import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { MerchantService } from "@/services/merchant-service";
import { CustomersDal } from "@/dal/customers";
import { ConversationsDal } from "@/dal/conversations";
import { OrdersDal } from "@/dal/orders";
import { NegotiationsDal } from "@/dal/negotiations";
import { RefundLogsDal } from "@/dal/refund-logs";
import { RefundService } from "@/services/refund-service";
import { encryptAes256 } from "@/lib/encryption";

const { createRefundMock } = vi.hoisted(() => ({
  createRefundMock: vi.fn<
    (params: { shopDomain: string; amount: number; currency: string }) => Promise<{
      refundId: string;
      transactionId: string;
    }>
  >(async () => ({
    refundId: "shopify-refund-123",
    transactionId: "shopify-tx-123",
  })),
}));

vi.mock("@/lib/shopify/client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/shopify/client")>("@/lib/shopify/client");
  return {
    ...actual,
    createRefund: createRefundMock,
  };
});

describe("RefundService.executeRefund", () => {
  let supabase: SupabaseClient;
  let merchantService: MerchantService;
  let customersDal: CustomersDal;
  let conversationsDal: ConversationsDal;
  let ordersDal: OrdersDal;
  let negotiationsDal: NegotiationsDal;
  let refundLogsDal: RefundLogsDal;
  let refundService: RefundService;

  let merchantId = "";
  let negotiationId = "";
  let runTag = "";

  beforeAll(async () => {
    supabase = createSupabaseAdminClient();
    merchantService = new MerchantService(supabase);
    customersDal = new CustomersDal(supabase);
    conversationsDal = new ConversationsDal(supabase);
    ordersDal = new OrdersDal(supabase);
    negotiationsDal = new NegotiationsDal(supabase);
    refundLogsDal = new RefundLogsDal(supabase);
    refundService = new RefundService(supabase);
    runTag = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    const merchant = await merchantService.create({
      shopDomain: `refund-e2e-${runTag}.myshopify.com`,
      shopName: "Refund E2E Merchant",
      email: `refund-e2e-${runTag}@test.local`,
      subscriptionTier: "starter",
      subscriptionStatus: "active",
      onboardingCompleted: true,
    });
    merchantId = merchant.id;

    await merchantService.update(merchant.id, {
      shopifyAccessTokenEncrypted: encryptAes256("shpat_test_access_token"),
    });

    const customer = await customersDal.create({
      merchantId,
      email: "refund-customer@test.nl",
      name: "Refund Customer",
      language: "nl",
    });

    const conversation = await conversationsDal.create({
      merchantId,
      customerId: customer.id,
      channel: "email",
      status: "negotiating",
      subject: "Refund test",
    });

    const order = await ordersDal.create({
      merchantId,
      shopifyOrderId: `gid://shopify/Order/${runTag}-9001`,
      shopifyOrderNumber: "#9001",
      customerId: customer.id,
      email: "refund-customer@test.nl",
      totalPrice: 120,
      currency: "EUR",
    });

    const negotiation = await negotiationsDal.create({
      merchantId,
      conversationId: conversation.id,
      customerId: customer.id,
      orderId: order.id,
      status: "completed",
      currentStep: 2,
      maxSteps: 3,
      offers: [],
      finalRefundAmount: 35,
      finalRefundType: "partial_refund",
    });
    negotiationId = negotiation.id;
  });

  afterAll(async () => {
    if (merchantId) {
      await merchantService.delete(merchantId);
    }
  });

  it("executes Shopify refund, stores shopify_refund_id and writes refund log", async () => {
    createRefundMock.mockClear();

    await refundService.executeRefund(negotiationId);

    expect(createRefundMock).toHaveBeenCalledTimes(1);
    const firstCall = createRefundMock.mock.calls.at(0);
    expect(firstCall).toBeTruthy();
    const calledWith = firstCall![0];
    expect(calledWith.shopDomain).toBe(`refund-e2e-${runTag}.myshopify.com`);
    expect(calledWith.amount).toBe(35);
    expect(calledWith.currency).toBe("EUR");

    const updatedNegotiation = await negotiationsDal.findById(negotiationId);
    expect(updatedNegotiation?.shopifyRefundId).toBe("shopify-refund-123");

    const logs = await refundLogsDal.findByMerchant(merchantId);
    const log = logs.find((item) => item.negotiationId === negotiationId && item.shopifyRefundId === "shopify-refund-123");
    expect(log).toBeTruthy();
    expect(log?.action).toBe("partial_refund_accepted");
    expect(log?.customerConsentRecorded).toBe(true);
  });
});
