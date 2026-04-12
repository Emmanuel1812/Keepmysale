import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmailViaSes } from "@/lib/ses/client";
import { logger } from "@/lib/logger";
import { MerchantService } from "@/services/merchant-service";
import { AiService } from "@/services/ai-service";
import { verifyShopifyWebhookSignature } from "@/lib/shopify/webhooks";
import { CustomerService } from "@/services/customer-service";
import { ConversationService } from "@/services/conversation-service";
import { MessageService } from "@/services/message-service";
import { NegotiationService, checkNegotiationEligibility } from "@/services/negotiation-service";
import { OrderService } from "@/services/order-service";
import { decryptAes256 } from "@/lib/encryption";
import { getValidAccessToken, sendGmailReply } from "@/lib/gmail/client";
import { formatEmailResponse } from "@/lib/utils/email-formatter";
import { extractCleanEmail, stripHtml } from "@/lib/email/parser";

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
    // 0. Clean the body
    const cleanBody = stripHtml(input.textBody || "");
    
    const existingByExternalId = await this.messageService.findByExternalMessageId(
      input.merchantId,
      input.messageId,
    );
    if (existingByExternalId) {
      return { deduplicated: true as const };
    }

    const cleanFrom = extractCleanEmail(input.from);

    const merchant = await this.merchantService.findById(input.merchantId);
    if (!merchant) {
      throw new Error("Merchant not found");
    }

    const customer = await this.customerService.resolveCustomer({
      merchantId: input.merchantId,
      email: cleanFrom,
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
      content: cleanBody,
      externalMessageId: input.messageId,
      metadata: { 
        direction: "inbound", 
        source: input.gmailThreadId ? "gmail" : "ses",
        threadId: input.gmailThreadId || null,
        ...input.metadata,
      },
    });

    const classification = await this.aiService.classifyIntent(cleanBody);
    console.log("[WEBHOOK] Classification:", JSON.stringify(classification));
    const settings = merchant.settings;

    // ── Settings Guard: do_not_engage_subjects ──────────────────
    const doNotEngage = settings.do_not_engage_subjects ?? [];
    if (doNotEngage.length > 0) {
      const subjectLower = (input.subject || "").toLowerCase();
      const blocked = doNotEngage.find((s) => subjectLower.includes(s.toLowerCase()));
      if (blocked) {
        console.log(`[WEBHOOK] Subject blocked by do_not_engage_subjects: "${blocked}"`);
        logger({
          level: "info",
          eventType: "automation.blocked.do_not_engage",
          merchantId: input.merchantId,
          message: `Subject matched do_not_engage rule: ${blocked}`,
          details: { subject: input.subject },
        });
        return { deduplicated: false as const, action: "blocked_by_settings", blocked: true };
      }
    }

    // ── Settings Guard: auto_reply per intent ────────────────────
    const intentAutoReplyMap: Record<string, boolean> = {
      wismo: settings.auto_reply_wismo !== false,
      return: settings.auto_negotiate !== false,
      complaint: settings.auto_reply_complaint === true,
      other: settings.auto_reply_general !== false,
      faq: settings.auto_reply_general !== false,
      exchange: settings.auto_reply_general !== false,
      resend_confirmation: settings.auto_reply_wismo !== false,
    };
    const shouldAutoReply = intentAutoReplyMap[classification.intent] ?? settings.auto_reply_general !== false;

    // ── Settings Guard: requires_human_threshold ─────────────────
    const confidenceThreshold = settings.requires_human_threshold ?? 0.6;
    const belowThreshold = classification.confidence < confidenceThreshold;
    if (belowThreshold) {
      console.log(`[WEBHOOK] Confidence ${classification.confidence} below threshold ${confidenceThreshold} — flagging for human review`);
    }

    const shouldSkipAutoReply = !shouldAutoReply || classification.requires_human || belowThreshold;

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
          // Extract customer name from Shopify order if missing
          if (!customer.name && (shopifyOrder as any).customer) {
            const firstName = (shopifyOrder as any).customer.first_name;
            const lastName = (shopifyOrder as any).customer.last_name;
            customer.name = firstName ? (lastName ? `${firstName} ${lastName}` : firstName) : null;
          }

          const existingOrders = await this.orderService.findByMerchant(input.merchantId);
          const matched = existingOrders.find((o) => o.shopifyOrderId === shopifyOrder.id);
          if (matched) {
            orderIdForNegotiation = matched.id;
          }
        }
      }
    }

    if (classification.intent === "return" && orderIdForNegotiation && settings.auto_negotiate !== false) {
      // Check negotiation eligibility based on settings
      const existingOrders = await this.orderService.findByMerchant(input.merchantId);
      const matchedOrder = existingOrders.find((o) => o.id === orderIdForNegotiation);
      const orderAmount = matchedOrder ? Number(matchedOrder.totalPrice) : 0;
      const lineItems = (matchedOrder?.lineItems as Array<{ title?: string; product_type?: string; category?: string }>) ?? null;

      const eligibility = checkNegotiationEligibility(orderAmount, lineItems, settings);
      if (eligibility.eligible) {
        await this.negotiationService.initiateNegotiation(
          input.merchantId,
          conversation.id,
          customer.id,
          orderIdForNegotiation,
          settings,
        );
      } else {
        console.log(`[WEBHOOK] Negotiation skipped: ${eligibility.reason}`);
      }
    }

    const action = await this.aiService.buildAutomatedAction({
      incomingText: cleanBody,
      history: recentHistory,
      orderNameGuess: classification.extracted_order_number ?? undefined,
      customerName: customer.name || undefined,
      storeName: merchant.shopName || undefined,
      shopDomain: merchant.shopDomain,
      shopAccessToken: decryptedShopifyAccessToken,
      merchantSettings: merchant.settings,
    });

    console.log("[WEBHOOK] Action:", action.action);
    console.log("[WEBHOOK] Response body:", action.messageBody?.substring(0, 200));
    console.log("[WEBHOOK] Negotiation decision:", action.negotiationDecision);
    console.log("[WEBHOOK] shouldSkipAutoReply:", shouldSkipAutoReply, "| shadow_mode:", settings.shadow_mode);

    // Sync negotiation status if requested by AI
    const activeNegotiations = await this.negotiationService.findByConversation(conversation.id);
    const activeNeg = activeNegotiations.find((n) => !["completed", "expired", "return_initiated"].includes(n.status));

    if (activeNeg && action.negotiationDecision && action.negotiationDecision !== "continue") {
      console.log("[WEBHOOK] Updating negotiation status to:", action.negotiationDecision);
      await this.negotiationService.processCustomerResponse(
        activeNeg.id,
        action.negotiationDecision === "accept" ? "accept_offer" : "reject_offer",
        settings,
      );
    }

    // ── Determine if we should send or just draft ─────────────
    const isShadowMode = settings.shadow_mode === true;
    const senderLabel = (shouldSkipAutoReply || isShadowMode) ? "ai_draft" : "ai";

    await this.messageService.create({
      conversationId: conversation.id,
      merchantId: input.merchantId,
      sender: senderLabel,
      channel: "email",
      content: action.messageBody,
      externalMessageId: null,
      metadata: {
        direction: "outbound",
        intent: classification.intent,
        confidence: classification.confidence,
        requires_human: classification.requires_human,
        below_confidence_threshold: belowThreshold,
        auto_reply_blocked: !shouldAutoReply,
        shadow_mode: isShadowMode,
        negotiation_decision: action.negotiationDecision,
      },
    });

    // If auto-reply is blocked, shadow mode is on, or human review is needed → don't send
    if (shouldSkipAutoReply || isShadowMode) {
      const reason = isShadowMode
        ? "shadow_mode"
        : !shouldAutoReply
          ? "auto_reply_disabled"
          : belowThreshold
            ? "below_confidence_threshold"
            : "requires_human";
      console.log(`[WEBHOOK] Email NOT sent (${reason}). Draft saved for merchant review.`);
      logger({
        level: "info",
        eventType: "automation.draft.saved",
        merchantId: input.merchantId,
        message: `Draft created: ${reason}`,
        details: { intent: classification.intent, confidence: classification.confidence },
      });
      return { deduplicated: false as const, action: "draft_saved", reason };
    }

    // ── Build formatted email using full settings ─────────────
    let finalCustomerName = customer.name;
    if (!finalCustomerName) {
      if (input.from.includes("<")) {
        const displayName = input.from.split("<")[0].replace(/"/g, "").trim();
        if (displayName) finalCustomerName = displayName;
      }
    }
    if (!finalCustomerName) {
      finalCustomerName = cleanFrom.split("@")[0];
    }

    const template = formatEmailResponse({
      customerName: finalCustomerName,
      aiResponse: action.messageBody,
      storeName: merchant.shopName || merchant.shopDomain.replace(".myshopify.com", ""),
      language: settings.language || "nl",
      settings,
    });

    if (merchant.googleEmail) {
      console.log("[WEBHOOK] Sending via Gmail:", merchant.googleEmail);
      const accessToken = await getValidAccessToken(merchant);
      await sendGmailReply(accessToken, {
        to: input.from,
        subject: input.subject,
        html: template.html,
        text: template.text,
        threadId: input.gmailThreadId,
      });
    } else {
      console.log("[WEBHOOK] Sending via SES fallback");
      await sendEmailViaSes({
        to: input.from,
        subject: `Re: ${input.subject}`,
        html: template.html,
        text: template.text,
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
