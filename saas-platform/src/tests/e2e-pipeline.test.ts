import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { WebhookService } from "@/services/webhook-service";
import { NegotiationService } from "@/services/negotiation-service";
import { CustomerService } from "@/services/customer-service";
import { MerchantService } from "@/services/merchant-service";
import { CustomersDal } from "@/dal/customers";
import { OrdersDal } from "@/dal/orders";
import { ConversationsDal } from "@/dal/conversations";
import { MessagesDal } from "@/dal/messages";
import { NegotiationsDal } from "@/dal/negotiations";
import { RefundLogsDal } from "@/dal/refund-logs";
import type { IMerchantSettings } from "@/types/merchant";
import { encryptAes256 } from "@/lib/encryption";

vi.mock("@/lib/ses/client", () => ({
  sendEmailViaSes: vi.fn(async () => ({ messageId: "mocked-ses-message-id" })),
}));

vi.mock("@/lib/shopify/client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/shopify/client")>("@/lib/shopify/client");
  return {
    ...actual,
    createRefund: vi.fn(async () => ({ refundId: "mocked-refund-id", transactionId: "mocked-tx-id" })),
  };
});

const defaultSettings: IMerchantSettings = {
  // Language & Communication
  language: "nl",
  tone: "professional",
  greeting_style: "time_based",
  sign_off_name: "E2E Team",
  sign_off_text: "Met vriendelijke groet,",
  custom_intro: "Bedankt voor je bericht over je bestelling.",

  // Return Negotiation
  auto_negotiate: true,
  negotiation_steps: [
    { step: 1, percentage: 20, type: "partial_refund" },
    { step: 2, percentage: 35, type: "partial_refund" },
    { step: 3, percentage: 50, type: "store_credit" },
  ],
  max_steps: 3,
  excluded_categories: [],
  excluded_keywords: [],
  min_order_value: 0,
  max_refund_percentage: 50,
  shadow_mode: false,

  // Automation & Escalation
  auto_reply_wismo: true,
  auto_reply_general: true,
  auto_reply_complaint: false,
  requires_human_threshold: 0.6,
  escalate_after_steps: 3,
  proactive_check_enabled: true,
  proactive_check_delay_hours: 48,

  // Rules & Restrictions
  forbidden_topics: [],
  forbidden_phrases: [],
  required_phrases: [],
  custom_rules: [],
  do_not_engage_subjects: [],

  // Shopify & Order Info
  include_tracking_in_wismo: true,
  include_line_items_in_wismo: true,
  currency_display: "EUR",

  // Legacy/Other
  business_hours: { start: "09:00", end: "17:00" },
  timezone: "Europe/Amsterdam",
  escalation_email: null,
};

describe("E2E inbound email pipeline", () => {
  let supabase: SupabaseClient;
  let merchantService: MerchantService;
  let customersDal: CustomersDal;
  let ordersDal: OrdersDal;
  let conversationsDal: ConversationsDal;
  let messagesDal: MessagesDal;
  let negotiationsDal: NegotiationsDal;
  let refundLogsDal: RefundLogsDal;
  let webhookService: WebhookService;
  let negotiationService: NegotiationService;
  let customerService: CustomerService;

  let merchantId = "";
  let customerId = "";
  let conversationId = "";
  let runTag = "";

  beforeAll(async () => {
    supabase = createSupabaseAdminClient();
    merchantService = new MerchantService(supabase);
    customersDal = new CustomersDal(supabase);
    ordersDal = new OrdersDal(supabase);
    conversationsDal = new ConversationsDal(supabase);
    messagesDal = new MessagesDal(supabase);
    negotiationsDal = new NegotiationsDal(supabase);
    refundLogsDal = new RefundLogsDal(supabase);
    webhookService = new WebhookService(supabase);
    negotiationService = new NegotiationService(supabase);
    customerService = new CustomerService(supabase);

    runTag = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    const merchant = await merchantService.create({
      shopDomain: `e2e-${runTag}.myshopify.com`,
      shopName: `E2E Merchant ${runTag}`,
      email: `merchant-${runTag}@test.local`,
      settings: defaultSettings,
      subscriptionTier: "starter",
      subscriptionStatus: "active",
      onboardingCompleted: true,
    });
    await merchantService.update(merchant.id, {
      shopifyAccessTokenEncrypted: encryptAes256("shpat_test_access_token"),
    });
    merchantId = merchant.id;

    const customer = await customersDal.create({
      merchantId,
      email: "klant@test.nl",
      phone: null,
      name: "Test Klant",
      language: "nl",
      metadata: { seed: "e2e" },
    });
    customerId = customer.id;

    const order = await ordersDal.create({
      merchantId,
      shopifyOrderId: `gid://shopify/Order/e2e-${runTag}-1001`,
      shopifyOrderNumber: "#1001",
      customerId,
      email: "klant@test.nl",
      totalPrice: 100,
      currency: "EUR",
      trackingNumber: `TRACK-${runTag}`,
      trackingUrl: "https://example.com/tracking",
      lineItems: [{ sku: "SKU-1", qty: 1 }],
    });
    expect(order.id).toBeTruthy();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    if (merchantId) {
      await merchantService.delete(merchantId);
    }
  });

  it("TEST 1: Volledige WISMO Flow", async () => {
    const classifySpy = vi.spyOn(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (webhookService as any).aiService,
      "classifyIntent",
    );
    classifySpy.mockResolvedValue({
      intent: "wismo",
      confidence: 0.99,
      extracted_order_number: "#1001",
      language_detected: "nl",
      sentiment: "neutral",
      requires_human: false,
      reasoning: "mocked",
    });

    const actionSpy = vi.spyOn(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (webhookService as any).aiService,
      "buildAutomatedAction",
    );
    actionSpy.mockResolvedValue({
      action: "send_tracking_status",
      messageBody: "Je bestelling #1001 is onderweg.",
    });

    const orderSpy = vi.spyOn(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (webhookService as any).orderService,
      "fetchShopifyOrderByName",
    );
    orderSpy.mockResolvedValue({ id: `gid://shopify/Order/e2e-${runTag}-1001`, name: "#1001", trackingNumber: "X" });

    const result = await webhookService.handleInboundEmail({
      messageId: `test-1-${runTag}`,
      merchantId,
      from: "klant@test.nl",
      subject: "Waar is mijn bestelling",
      textBody: "Hallo, waar is mijn bestelling #1001?",
    });
    expect(result.deduplicated).toBe(false);

    const customers = await customersDal.findByMerchant(merchantId);
    const matchingCustomers = customers.filter((c) => c.email === "klant@test.nl");
    expect(matchingCustomers).toHaveLength(1);
    expect(matchingCustomers[0]?.id).toBe(customerId);

    const conversations = await conversationsDal.findByMerchant(merchantId);
    expect(conversations.length).toBeGreaterThan(0);
    const conversation = conversations.find((c) => c.customerId === customerId && c.channel === "email");
    expect(conversation).toBeTruthy();
    conversationId = conversation!.id;

    const messages = await messagesDal.findByConversation(conversationId);
    expect(messages.some((m) => m.sender === "customer" && m.content.includes("bestelling #1001"))).toBe(true);
    const outbound = messages.find((m) => m.sender === "ai");
    expect(outbound).toBeTruthy();
    expect(outbound?.metadata?.intent).toBe("wismo");

    expect(conversation?.lastMessageAt).toBeTruthy();
  });

  it("TEST 2: Volledige Return Negotiation Flow", async () => {
    const classifySpy = vi.spyOn(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (webhookService as any).aiService,
      "classifyIntent",
    );
    classifySpy.mockResolvedValue({
      intent: "return",
      confidence: 0.99,
      extracted_order_number: "#1001",
      language_detected: "nl",
      sentiment: "negative",
      requires_human: false,
      reasoning: "mocked",
    });

    const actionSpy = vi.spyOn(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (webhookService as any).aiService,
      "buildAutomatedAction",
    );
    actionSpy.mockResolvedValue({
      action: "offer_partial_refund",
      messageBody: "We kunnen een gedeeltelijke terugbetaling aanbieden.",
    });

    const orderSpy = vi.spyOn(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (webhookService as any).orderService,
      "fetchShopifyOrderByName",
    );
    orderSpy.mockResolvedValue({ id: `gid://shopify/Order/e2e-${runTag}-1001`, name: "#1001", trackingNumber: "X" });

    await webhookService.handleInboundEmail({
      messageId: `test-2-${runTag}`,
      merchantId,
      from: "klant@test.nl",
      subject: "Retour",
      textBody: "Ik wil mijn bestelling #1001 retourneren",
    });

    const negotiations = await negotiationsDal.findByMerchant(merchantId);
    const negotiation = negotiations[0];
    expect(negotiation).toBeTruthy();
    expect(negotiation.status).toBe("offer_sent");
    expect(negotiation.offers.length).toBeGreaterThan(0);
    expect(negotiation.offers[0]?.step).toBe(1);
    expect(negotiation.offers[0]?.percentage).toBe(20);

    const logsAfterInit = await refundLogsDal.findByMerchant(merchantId);
    expect(logsAfterInit.some((l) => l.action === "partial_refund_offered")).toBe(true);

    const conversation = await conversationsDal.findById(negotiation.conversationId);
    expect(conversation?.status === "open" || conversation?.status === "negotiating").toBe(true);

    const rejected = await negotiationService.processCustomerResponse(
      negotiation.id,
      "reject_offer",
      defaultSettings,
    );
    expect(rejected.status).toBe("offer_sent");
    expect(rejected.offers.some((o) => o.step === 2 && o.percentage === 35)).toBe(true);

    const logsAfterReject = await refundLogsDal.findByMerchant(merchantId);
    expect(logsAfterReject.some((l) => l.action === "offer_rejected")).toBe(true);

    const accepted = await negotiationService.processCustomerResponse(
      negotiation.id,
      "accept_offer",
      defaultSettings,
    );
    expect(accepted.status).toBe("completed");
    expect(accepted.finalRefundAmount).not.toBeNull();
    expect(accepted.savings).not.toBeNull();
    expect(accepted.completedAt).toBeTruthy();

    const logsAfterAccept = await refundLogsDal.findByMerchant(merchantId);
    const acceptedLog = logsAfterAccept.find((l) => l.action === "partial_refund_accepted");
    expect(acceptedLog).toBeTruthy();
    expect(acceptedLog?.customerConsentRecorded).toBe(true);
  });

  it("TEST 3: Idempotency", async () => {
    const classifySpy = vi.spyOn(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (webhookService as any).aiService,
      "classifyIntent",
    );
    classifySpy.mockResolvedValue({
      intent: "wismo",
      confidence: 0.95,
      extracted_order_number: "#1001",
      language_detected: "nl",
      sentiment: "neutral",
      requires_human: false,
      reasoning: "mocked",
    });

    const actionSpy = vi.spyOn(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (webhookService as any).aiService,
      "buildAutomatedAction",
    );
    actionSpy.mockResolvedValue({
      action: "send_tracking_status",
      messageBody: "Status update.",
    });

    const orderSpy = vi.spyOn(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (webhookService as any).orderService,
      "fetchShopifyOrderByName",
    );
    orderSpy.mockResolvedValue({ id: `gid://shopify/Order/e2e-${runTag}-1001`, name: "#1001", trackingNumber: "X" });

    const duplicateMessageId = `test-3-${runTag}`;

    const first = await webhookService.handleInboundEmail({
      messageId: duplicateMessageId,
      merchantId,
      from: "klant@test.nl",
      subject: "Waar is mijn bestelling",
      textBody: "Waar is bestelling #1001?",
    });
    const second = await webhookService.handleInboundEmail({
      messageId: duplicateMessageId,
      merchantId,
      from: "klant@test.nl",
      subject: "Waar is mijn bestelling",
      textBody: "Waar is bestelling #1001?",
    });

    expect(first.deduplicated).toBe(false);
    expect(second).toEqual({ deduplicated: true });

    const { data: messageRows } = await supabase
      .from("messages")
      .select("id")
      .eq("merchant_id", merchantId)
      .eq("external_message_id", duplicateMessageId);
    expect(messageRows ?? []).toHaveLength(1);

    const conversations = await conversationsDal.findByMerchant(merchantId);
    const customerConversations = conversations.filter((c) => c.customerId === customerId && c.channel === "email");
    expect(customerConversations).toHaveLength(1);
  });

  it("TEST 4: Cross-Channel Customer Merge", async () => {
    const existingBefore = await customersDal.findByMerchant(merchantId);
    const merged = await customerService.findOrCreate({
      merchantId,
      email: "klant@test.nl",
      phone: null,
      language: "nl",
      metadata: { from: "merge-test" },
    });
    const existingAfter = await customersDal.findByMerchant(merchantId);

    expect(merged.id).toBe(customerId);
    expect(existingAfter.length).toBe(existingBefore.length);
    const duplicates = existingAfter.filter((c) => c.email === "klant@test.nl");
    expect(duplicates).toHaveLength(1);
  });

  it("TEST 5: Conversation wordt hergebruikt voor dezelfde customer/channel", async () => {
    const classifySpy = vi.spyOn(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (webhookService as any).aiService,
      "classifyIntent",
    );
    classifySpy.mockResolvedValue({
      intent: "other",
      confidence: 0.9,
      extracted_order_number: null,
      language_detected: "nl",
      sentiment: "neutral",
      requires_human: false,
      reasoning: "mocked",
    });

    const actionSpy = vi.spyOn(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (webhookService as any).aiService,
      "buildAutomatedAction",
    );
    actionSpy.mockResolvedValue({
      action: "send_general_reply",
      messageBody: "Dank voor je bericht.",
    });

    const before = await conversationsDal.findByMerchant(merchantId);
    const existingCount = before.filter((c) => c.customerId === customerId && c.channel === "email").length;

    await webhookService.handleInboundEmail({
      messageId: `test-5-${runTag}`,
      merchantId,
      from: "klant@test.nl",
      subject: "Nieuwe vraag",
      textBody: "Ik heb nog een vraag over mijn bestelling",
    });

    const after = await conversationsDal.findByMerchant(merchantId);
    const afterCount = after.filter((c) => c.customerId === customerId && c.channel === "email").length;
    expect(afterCount).toBe(existingCount);
  });
});
