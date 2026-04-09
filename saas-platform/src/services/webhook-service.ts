import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmailViaSes } from "@/lib/ses/client";
import { logger } from "@/lib/logger";
import { MerchantService } from "@/services/merchant-service";
import { AiService } from "@/services/ai-service";
import { verifyShopifyWebhookSignature } from "@/lib/shopify/webhooks";
import { CustomerService } from "@/services/customer-service";
import { ConversationService } from "@/services/conversation-service";
import { MessageService } from "@/services/message-service";
import { NegotiationService } from "@/services/negotiation-service";
import { OrderService } from "@/services/order-service";
import { decryptAes256 } from "@/lib/encryption";
import { getValidAccessToken, sendGmailReply } from "@/lib/gmail/client";

export interface IInboundEmailInput {
  messageId: string;
  merchantId: string;
  from: string;
  subject: string;
  textBody: string;
  gmailThreadId?: string;
  metadata?: Record<string, any>;
}

export class WebhookService {
  private readonly merchantService: MerchantService;
  private readonly customerService: CustomerService;
  private readonly conversationService: ConversationService;
  private readonly messageService: MessageService;
  private readonly aiService: AiService;
  private readonly negotiationService: NegotiationService;
  private readonly orderService: OrderService;

  constructor(private readonly supabase: SupabaseClient) {
    this.merchantService = new MerchantService(supabase);
    this.customerService = new CustomerService(supabase);
    this.conversationService = new ConversationService(supabase);
    this.messageService = new MessageService(supabase);
    this.aiService = new AiService(supabase);
    this.negotiationService = new NegotiationService(supabase);
    this.orderService = new OrderService(supabase);
  }

  async handleInboundEmail(input: IInboundEmailInput) {
    // TODO: Implement full AWS SNS signature verification before production.
    // Current route-level validation only checks payload shape.

    const existingByExternalId = await this.messageService.findByExternalMessageId(
      input.merchantId,
      input.messageId,
    );
    if (existingByExternalId) {
      return { deduplicated: true as const };
    }

    const merchant = await this.merchantService.findById(input.merchantId);
    if (!merchant) {
      throw new Error("Merchant not found");
    }

    const customer = await this.customerService.resolveCustomer({
      merchantId: input.merchantId,
      email: input.from,
      language: merchant.settings.language,
    });

    const conversation = await this.conversationService.findOrCreate({
      merchantId: input.merchantId,
      customerId: customer.id,
      channel: "email",
      subject: input.subject,
      metadata: { source: "ses_webhook" },
    });

    await this.messageService.create({
      conversationId: conversation.id,
      merchantId: input.merchantId,
      sender: "customer",
      channel: "email",
      content: input.textBody,
      externalMessageId: input.messageId,
      metadata: { 
        direction: "inbound", 
        source: input.gmailThreadId ? "gmail" : "ses",
        threadId: input.gmailThreadId || null,
        ...input.metadata,
      },
    });

    const classification = await this.aiService.classifyIntent(input.textBody);
    console.log("[WEBHOOK] Classification:", JSON.stringify(classification));

    const history = await this.messageService.findByConversation(conversation.id);
    // Beperk tot laatste 10 berichten om token-limiet te besparen
    const recentHistory = history.slice(-10).map((m) => ({
      role: m.sender === "customer" ? ("user" as const) : ("assistant" as const),
      content: m.content,
    }));

    const decryptedShopifyAccessToken = merchant.shopifyAccessTokenEncrypted
      ? decryptAes256(merchant.shopifyAccessTokenEncrypted)
      : "";

    let orderIdForNegotiation: string | null = null;
    if (classification.intent === "wismo" || classification.intent === "return") {
      const orderNameGuess = classification.extracted_order_number ?? undefined;
      if (orderNameGuess) {
        const shopifyOrder = await this.orderService.fetchShopifyOrderByName(
          merchant.shopDomain,
          decryptedShopifyAccessToken,
          orderNameGuess,
        );
        if (shopifyOrder) {
          const existingOrders = await this.orderService.findByMerchant(input.merchantId);
          const matched = existingOrders.find((o) => o.shopifyOrderId === shopifyOrder.id);
          if (matched) {
            orderIdForNegotiation = matched.id;
          }
        }
      }
    }

    if (classification.intent === "return" && orderIdForNegotiation) {
      await this.negotiationService.initiateNegotiation(
        input.merchantId,
        conversation.id,
        customer.id,
        orderIdForNegotiation,
        merchant.settings,
      );
    }

    const action = await this.aiService.buildAutomatedAction({
      incomingText: input.textBody,
      history: recentHistory,
      orderNameGuess: classification.extracted_order_number ?? undefined,
      shopDomain: merchant.shopDomain,
      shopAccessToken: decryptedShopifyAccessToken,
      merchantSettings: merchant.settings,
    });
    console.log("[WEBHOOK] Action:", action.action);
    console.log("[WEBHOOK] Response body:", action.messageBody?.substring(0, 200));
    console.log("[WEBHOOK] Negotiation decision:", action.negotiationDecision);

    // Sync negotiation status if requested by AI
    const activeNegotiations = await this.negotiationService.findByConversation(conversation.id);
    const activeNeg = activeNegotiations.find((n) => !["completed", "expired", "return_initiated"].includes(n.status));

    if (activeNeg && action.negotiationDecision && action.negotiationDecision !== "continue") {
      console.log("[WEBHOOK] Updating negotiation status to:", action.negotiationDecision);
      await this.negotiationService.processCustomerResponse(
        activeNeg.id,
        action.negotiationDecision === "accept" ? "accept_offer" : "reject_offer",
        merchant.settings,
      );
    }

    await this.messageService.create({
      conversationId: conversation.id,
      merchantId: input.merchantId,
      sender: "ai",
      channel: "email",
      content: action.messageBody,
      externalMessageId: null,
      metadata: {
        direction: "outbound",
        intent: classification.intent,
        confidence: classification.confidence,
        requires_human: classification.requires_human,
        negotiation_decision: action.negotiationDecision,
      },
    });

    if (merchant.googleEmail) {
      console.log("[WEBHOOK] Sending via Gmail:", merchant.googleEmail);
      const accessToken = await getValidAccessToken(merchant);
      await sendGmailReply(accessToken, {
        to: input.from,
        subject: input.subject,
        html: `<p>${action.messageBody}</p>`,
        threadId: input.gmailThreadId,
      });
    } else {
      console.log("[WEBHOOK] Sending via SES fallback");
      await sendEmailViaSes({
        to: input.from,
        subject: `Re: ${input.subject}`,
        html: `<p>${action.messageBody}</p>`,
        text: action.messageBody,
      });
    }

    logger({
      level: "info",
      eventType: "automation.outbound.email",
      merchantId: input.merchantId,
      message: action.action,
      details: { inboundMessageId: input.messageId },
    });

    return { deduplicated: false as const, action: action.action };
  }

  async handleShopifyWebhook(
    rawBody: string,
    hmac: string | null,
    headers: { topic?: string | null; shopDomain?: string | null },
  ) {
    if (!verifyShopifyWebhookSignature(rawBody, hmac)) {
      throw new Error("Invalid Shopify webhook signature");
    }

    const topic = headers.topic ?? null;
    const shopDomain = headers.shopDomain ?? null;
    if (!topic || !shopDomain) {
      throw new Error("Missing Shopify webhook headers");
    }

    const merchant = await this.merchantService.findByShopDomain(shopDomain);
    if (!merchant) {
      throw new Error("Merchant not found for shop domain");
    }

    const payload = JSON.parse(rawBody) as Record<string, unknown>;

    if (topic === "orders/create" || topic === "orders/updated") {
      const customerEmail = (payload.email as string | undefined) ?? null;
      let customerId: string | null = null;
      if (customerEmail) {
        const customer = await this.customerService.resolveCustomer({
          merchantId: merchant.id,
          email: customerEmail,
          language: merchant.settings?.language ?? "nl",
        });
        customerId = customer.id;
      }

      const order = await this.orderService.upsertFromShopify(merchant.id, payload, customerId);
      return { accepted: true as const, topic, orderId: order.id };
    }

    if (topic === "fulfillments/create" || topic === "fulfillments/update") {
      const shopifyOrderId = String(payload.order_id ?? "");
      if (!shopifyOrderId) {
        throw new Error("Missing fulfillment order id");
      }

      const merchantOrders = await this.orderService.findByMerchant(merchant.id);
      const matchedOrder = merchantOrders.find((order) => order.shopifyOrderId.endsWith(shopifyOrderId));
      if (!matchedOrder) {
        return { accepted: true as const, topic, orderId: null };
      }

      const trackingNumber = (payload.tracking_number as string | undefined) ?? null;
      const trackingUrl = (payload.tracking_url as string | undefined) ?? null;
      const trackingCompany = (payload.tracking_company as string | undefined) ?? null;
      const status = (payload.shipment_status as string | undefined) ?? null;
      const deliveredAt = status === "delivered" ? new Date().toISOString() : null;
      const proactivePending =
        (merchant.settings?.proactive_check_enabled ?? false) && status === "delivered" ? false : undefined;

      const updated = await this.orderService.updateTracking(matchedOrder.id, {
        trackingNumber,
        trackingUrl,
        trackingCompany,
        deliveredAt,
        proactiveCheckSent: proactivePending,
        fulfillmentStatus: status ?? matchedOrder.fulfillmentStatus,
      });

      return { accepted: true as const, topic, orderId: updated.id };
    }

    return { accepted: true as const, topic };
  }
}
