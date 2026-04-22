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

function stripQuotedText(text: string): string {
  const patterns = [
    /On .+ wrote:[\s\S]*/m,
    /Op .+ schreef.*:[\s\S]*/m,
    /Em .+ escreveu:[\s\S]*/m,
    /^>.*$/gm,
    /---------- Forwarded message[\s\S]*/m,
    /^-{2,}$/gm,
    /^Sent from my.*/mi,
    /^Verzonden vanaf mijn.*/mi,
  ];
  
  let cleaned = text;
  for (const pattern of patterns) {
    cleaned = cleaned.replace(pattern, '');
  }
  return cleaned.trim();
}

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
    console.log("[DEBUG] Processing email from: " + input.from);

    // 0. Clean the body
    const noQuotes = stripQuotedText(input.textBody || "");
    const cleanBody = stripHtml(noQuotes);
    
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

    console.log(`[WEBHOOK] Processing inbound email from: ${input.from} | Subject: ${input.subject}`);
    console.log(`[WEBHOOK] Resolved conversation: ${conversation.id} (status: ${conversation.status}) | Customer: ${customer.id}`);
    console.log(`[WEBHOOK] Body snippet: ${cleanBody.substring(0, 500)}`);

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

    const existingOrders = await this.orderService.findByMerchant(input.merchantId);
    const isKnownCustomer = existingOrders.some((o) => o.email?.toLowerCase() === cleanFrom.toLowerCase());
    console.log("[DEBUG] Is known customer: " + isKnownCustomer);
    
    const historyCheck = await this.messageService.findByConversation(conversation.id);
    const isActiveConversation = historyCheck.length > 1;

    if (!isKnownCustomer && !isActiveConversation) {
      console.log("[WEBHOOK] Sender not a known customer, skipping AI processing");
      
      await this.conversationService.update(conversation.id, {
        category: "unknown",
        isKnownCustomer: false,
        metadata: { ...((conversation.metadata as Record<string, unknown>) || {}) }
      });

      return { deduplicated: false as const, action: "blocked_unknown" };
    }

    console.log("[DEBUG] Passed email filter: true");
    if (input.metadata?.blockedByCategory) {
      console.log("[DEBUG] Passed email filter: false (blocked as " + input.metadata.blockedByCategory + ")");
      console.log(`[WEBHOOK] Email pre-blocked by automation filter as: ${input.metadata.blockedByCategory}`);
      await this.conversationService.update(conversation.id, {
        category: input.metadata.blockedByCategory,
        isKnownCustomer
      });
      return { deduplicated: false as const, action: "blocked_prefilter" };
    }

    const classification = await this.aiService.classifyIntent(cleanBody);
    console.log("[DEBUG] Intent: " + classification.intent);
    console.log("[WEBHOOK] Classification Result:", JSON.stringify(classification, null, 2));
    const settings = merchant.settings;

    // ── Settings Guard: do_not_engage_subjects ──────────────────
    const doNotEngage = settings.do_not_engage_subjects ?? [];
    if (doNotEngage.length > 0) {
      const subjectLower = (input.subject || "").toLowerCase();
      const blocked = doNotEngage.find((s) => subjectLower.includes(s.toLowerCase()));
      if (blocked) {
        console.log(`[WEBHOOK] Subject BLOCKED by rule: "${blocked}"`);
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
      console.log(`[WEBHOOK] FLAG: Confidence ${classification.confidence} is below the threshold of ${confidenceThreshold}`);
    }

    const isNegotiation = classification.intent === "return" && settings.auto_negotiate !== false;
    let shouldSkipAutoReply = !shouldAutoReply || classification.requires_human || belowThreshold;
    
    // Informational intents should ALWAYS send (never draft)
    if (classification.intent === "wismo" || 
        classification.intent === "faq" || 
        classification.intent === "resend_confirmation") {
      console.log("[WEBHOOK] Informational intent '" + classification.intent + "' — forcing send.");
      shouldSkipAutoReply = false;
    }

    // ── Special Case: Automated Negotiation Bypass ───────────────
    if (isNegotiation) {
      console.log("[WEBHOOK] Negotiation intent detected. Bypassing skip guards.");
      shouldSkipAutoReply = false;
    }

    console.log(`[WEBHOOK] Initial Decision -> autoReplyEnabled: ${shouldAutoReply}, requiresHuman: ${classification.requires_human}, belowThreshold: ${belowThreshold} | Result: skip=${shouldSkipAutoReply}`);

    const history = await this.messageService.findByConversation(conversation.id);
    const recentHistory = history.slice(-10).map((m) => ({
      role: m.sender === "customer" ? ("user" as const) : ("assistant" as const),
      content: m.content,
    }));

    const decryptedShopifyAccessToken = merchant.shopifyAccessTokenEncrypted
      ? decryptAes256(merchant.shopifyAccessTokenEncrypted)
      : "";

    let orderIdForNegotiation: string | null = null;
    const orderNameGuess = classification.extracted_order_number ?? undefined;

    if (orderNameGuess) {
      console.log(`[WEBHOOK] Attempting to fetch order data for: ${orderNameGuess}`);
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
          console.log(`[WEBHOOK] Extracted name from order: ${customer.name}`);
        }

        const existingOrders = await this.orderService.findByMerchant(input.merchantId);
        const matched = existingOrders.find((o) => o.shopifyOrderId === shopifyOrder.id);
        if (matched) {
          orderIdForNegotiation = matched.id;
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

    // ── Lookup active negotiation: try by conversation first, then fall back to customer ──
    const activeNegotiations = await this.negotiationService.findByConversation(conversation.id);
    console.log(`[WEBHOOK] Negotiations for conv ${conversation.id}: found ${activeNegotiations.length}, statuses: [${activeNegotiations.map(n => `${n.status}(step=${n.currentStep})`).join(', ')}]`);
    
    let activeNeg = activeNegotiations.find((n) => !["completed", "expired", "return_initiated"].includes(n.status));

    // Fallback: if no active negotiation found for this conversation, check by customer
    // This handles the case where the conversation threading diverged
    if (!activeNeg) {
      console.log(`[WEBHOOK] No active negotiation found for conversation. Trying fallback by customer ${customer.id}...`);
      const customerNegs = await this.negotiationService.findActiveByCustomer(input.merchantId, customer.id);
      console.log(`[WEBHOOK] Customer fallback: found ${customerNegs.length} active negotiations`);
      if (customerNegs.length > 0) {
        activeNeg = customerNegs[0];
        console.log(`[WEBHOOK] Using customer fallback negotiation: ID=${activeNeg.id}, Status=${activeNeg.status}, Step=${activeNeg.currentStep}, ConvID=${activeNeg.conversationId}`);
      }
    }

    if (activeNeg) {
      console.log(`[WEBHOOK] Active negotiation found: ID=${activeNeg.id}, Status=${activeNeg.status}, Step=${activeNeg.currentStep}`);
      if (settings.auto_negotiate !== false) {
        console.log("[WEBHOOK] Active negotiation loop detected. Bypassing skip guards.");
        shouldSkipAutoReply = false;
      }
    } else {
      console.log(`[WEBHOOK] NO active negotiation found. shouldSkipAutoReply remains: ${shouldSkipAutoReply}`);
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
      activeNegotiation: activeNeg,
    });

    console.log("[DEBUG] Action: " + action.action);
    console.log("[WEBHOOK] Action:", action.action);
    console.log("[WEBHOOK] Response body:", action.messageBody?.substring(0, 200));
    console.log("[WEBHOOK] Negotiation decision:", action.negotiationDecision);

    console.log("[WEBHOOK] shouldSkipAutoReply:", shouldSkipAutoReply, "| shadow_mode:", settings.shadow_mode);

    // ── Final Safety Bypass ─────────
    if (activeNeg && action.negotiationDecision && action.negotiationDecision !== "continue") {
      if (action.negotiationDecision === "reject") {
        console.log(`[WEBHOOK] AI Decision is 'reject', escalating to human (creating draft).`);
        shouldSkipAutoReply = true;
      } else {
        console.log(`[WEBHOOK] AI Decision '${action.negotiationDecision}' detected for active negotiation. Forcing email send.`);
        shouldSkipAutoReply = false;
      }
    }

    if (activeNeg && action.negotiationDecision && action.negotiationDecision !== "continue") {
      console.log("[WEBHOOK] Updating negotiation status to:", action.negotiationDecision);
      if (action.negotiationDecision === "accept") {
        await this.negotiationService.processCustomerResponse(activeNeg.id, "accept_offer", settings);
      } else if (action.negotiationDecision === "next_step") {
        await this.negotiationService.processCustomerResponse(activeNeg.id, "reject_offer", settings);
      } else if (action.negotiationDecision === "reject") {
        await this.negotiationService.processCustomerResponse(activeNeg.id, "request_full_return", settings);
      }
    }

    // ── Build formatted email using full settings FIRST to save to DB ─────────────
    if (action.messageBody) {
      action.messageBody = action.messageBody.replace(/\n{3,}/g, '\n\n');
    }

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

    // ── NUCLEAR OVERRIDE: If AI returned a negotiation decision that ──────────
    // ── is not "reject", ALWAYS send — regardless of intent classification, ──
    // ── requires_human, or any other flag. ────────────────────────────────────
    if (action.negotiationDecision &&
        action.negotiationDecision !== "reject" &&
        action.negotiationDecision !== "continue") {
      console.log("[WEBHOOK] NUCLEAR OVERRIDE: Negotiation decision is " +
        action.negotiationDecision + ", forcing send regardless of all flags.");
      shouldSkipAutoReply = false;
    }

    // ── Determine if we should send or just draft ─────────────
    const isShadowMode = settings.shadow_mode === true;

    // ── FINAL STATE LOG ──────────────────────────────────────────────────────
    console.log("[WEBHOOK] FINAL STATE:", JSON.stringify({
      shouldSkipAutoReply,
      isShadowMode: settings.shadow_mode,
      negotiationDecision: action.negotiationDecision,
      activeNegId: activeNeg?.id || null,
      intent: classification.intent,
      requiresHuman: classification.requires_human
    }));

    let senderLabel = (shouldSkipAutoReply || isShadowMode) ? "ai_draft" : "ai";

    // --- SCHEDULING LOGIC ---
    let scheduleSendAt: string | null = null;
    let isScheduled = false;

    if (!shouldSkipAutoReply && !isShadowMode) {
      // 1. Base delay
      const delayMs = (settings.response_delay_hours || 0) * 3600000;
      let earliest = new Date(Date.now() + delayMs);
      
      const tz = settings.business_hours_timezone || "Europe/Amsterdam";
      const startStr = settings.business_hours_start || "09:00";
      const endStr = settings.business_hours_end || "18:00";
      const replyWeekends = settings.business_hours_weekends === true;

      const [sH, sM] = startStr.split(":").map(Number);
      const [eH, eM] = endStr.split(":").map(Number);
      const startMinutes = sH * 60 + sM;
      const endMinutes = eH * 60 + eM;

      // Ensure we iterate to find the valid slot
      while (true) {
        // Resolve time components locally relative to the merchant timezone
        const localeString = earliest.toLocaleString("en-US", { timeZone: tz, hour12: false });
        // Example "4/24/2026, 08:30:00"
        const localDate = new Date(localeString);
        
        const currentHours = localDate.getHours();
        const currentMins = localDate.getMinutes();
        const currentTotalMins = currentHours * 60 + currentMins;
        
        // In Javascript, 0 is Sunday, 6 is Saturday (relative roughly, toLocaleString extracts local numbers if we format explicitly, 
        // to securely get weekday in target timezone:)
        const wdFormat = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" }).format(earliest);
        const isWeekend = wdFormat === "Sat" || wdFormat === "Sun";

        // Logic check
        if (isWeekend && !replyWeekends) {
           // Skip to next day 00:00
           earliest = new Date(earliest.getTime() + 24*3600*1000);
           earliest.setHours(0, 0, 0, 0); // Note: setHours runs in Server Time, but resetting offsets it enough generally for the while loop
           // To precisely roll forward 24hrs securely ignoring server time complexities:
           // Since we just need to bump to next day, adding 24h works.
           continue;
        }

        if (currentTotalMins < startMinutes) {
           // Too early, wait until start time today.
           // How many minutes to add?
           const diff = startMinutes - currentTotalMins;
           earliest = new Date(earliest.getTime() + diff * 60000);
           continue;
        }

        if (currentTotalMins > endMinutes) {
           // Too late, wait until tomorrow boundary
           const forwardDiff = (24 * 60 - currentTotalMins) + startMinutes;
           earliest = new Date(earliest.getTime() + forwardDiff * 60000);
           continue;
        }

        // Inside bounds!
        break;
      }

      // At this point, `earliest` holds the correct absolute Time.
      // If it's more than 30 seconds away from *right now*, we must schedule it
      if (earliest.getTime() > Date.now() + 30000) {
        isScheduled = true;
        scheduleSendAt = earliest.toISOString();
        senderLabel = "ai_scheduled" as any;
      }
    }

    console.log(`[DEBUG] Send or draft: ${senderLabel} | Scheduled: ${isScheduled} (${scheduleSendAt})`);

    try {
      await this.messageService.create({
        conversationId: conversation.id,
        merchantId: input.merchantId,
        sender: senderLabel as any,
        channel: "email",
        content: template.text, // Store fully formatted message so UI shows greetings
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
        isScheduled,
        scheduledSendAt: scheduleSendAt,
      });
    } catch (err: any) {
      // FALLBACK: If the DB hasn't been updated with the 'ai_draft' enum, 
      // save as 'ai' but track draft status in metadata to avoid logic crash.
      if (err.message?.includes("enum") || err.code === "22P02") {
        console.warn("[WEBHOOK] 'ai_draft' enum missing, falling back to 'ai' with metadata.");
        await this.messageService.create({
          conversationId: conversation.id,
          merchantId: input.merchantId,
          sender: "ai",
          channel: "email",
          content: template.text,
          metadata: {
            is_fallback_draft: true,
            original_sender: senderLabel,
            intent: classification.intent,
          },
        });
      } else {
        throw err;
      }
    }

    let assignedCategory: string | undefined = undefined;
    
    if (activeNeg && action.negotiationDecision) {
      if (action.negotiationDecision === "accept" || action.negotiationDecision === "next_step" || action.negotiationDecision === "continue") {
        assignedCategory = "returns";
      } else if (action.negotiationDecision === "reject") {
        assignedCategory = "human_required";
      }
    }

    if (!assignedCategory) {
      if (classification.intent === "wismo" || classification.intent === "resend_confirmation") assignedCategory = "shipping";
      else if (classification.intent === "return" || classification.intent === "exchange") assignedCategory = "returns";
      else if (classification.intent === "faq") assignedCategory = "product";
      else if (classification.intent === "complaint") assignedCategory = "human_required";
      else if (classification.requires_human) assignedCategory = "human_required";
      else assignedCategory = "human_required";
    }

    await this.conversationService.update(conversation.id, { 
      category: assignedCategory,
      isKnownCustomer
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
      
      console.log(`[WEBHOOK] BLOCK: Email NOT sent. Reason: ${reason} (shouldSkip: ${shouldSkipAutoReply}, shadow: ${isShadowMode})`);
      
      logger({
        level: "info",
        eventType: "automation.draft.saved",
        merchantId: input.merchantId,
        message: `Draft created: ${reason}`,
        details: { 
          intent: classification.intent, 
          confidence: classification.confidence,
          shouldSkipAutoReply,
          isShadowMode
        },
      });
      return { deduplicated: false as const, action: "draft_saved", reason };
    }

    if (isScheduled) {
      console.log(`[WEBHOOK] BLOCK: Email SCHEDULED for ${scheduleSendAt} instead of immediate send.`);
      logger({
        level: "info",
        eventType: "automation.outbound.scheduled",
        merchantId: input.merchantId,
        message: `Message scheduled for ${scheduleSendAt}`,
        details: { scheduleSendAt, intent: classification.intent }
      });
      return { deduplicated: false as const, action: "scheduled" };
    }

    // Formatting moved up to save in database

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
        let customerName: string | undefined = undefined;
        if (payload.customer) {
            const firstName = (payload.customer as any).first_name;
            const lastName = (payload.customer as any).last_name;
            customerName = firstName ? (lastName ? `${firstName} ${lastName}` : firstName) : undefined;
        } else if (payload.billing_address) {
            const firstName = (payload.billing_address as any).first_name;
            const lastName = (payload.billing_address as any).last_name;
            customerName = firstName ? (lastName ? `${firstName} ${lastName}` : firstName) : undefined;
        }

        const customer = await this.customerService.resolveCustomer({
          merchantId: merchant.id,
          email: customerEmail,
          name: customerName,
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

  /**
   * Manually trigger an AI resolution for an existing conversation.
   * This ignores shadow mode/auto-reply settings because a human is requesting it.
   */
  async processAiResolution(conversationId: string, merchantId: string) {
    const merchant = await this.merchantService.findById(merchantId);
    if (!merchant) throw new Error("Merchant not found");

    const conversation = await this.conversationService.findById(conversationId);
    if (!conversation) throw new Error("Conversation not found");

    const messages = await this.messageService.findByConversation(conversationId);
    const lastCustomerMsg = [...messages].reverse().find((m) => m.sender === "customer");
    
    if (!lastCustomerMsg) {
      throw new Error("No customer message found to respond to");
    }

    const customer = await this.customerService.findById(conversation.customerId);
    if (!customer) throw new Error("Customer not found");

    // 1. Build context
    const recentHistory = messages.slice(-10).map((m) => ({
      role: m.sender === "customer" ? ("user" as const) : ("assistant" as const),
      content: m.content,
    }));

    const classification = await this.aiService.classifyIntent(lastCustomerMsg.content);
    
    const decryptedShopifyAccessToken = merchant.shopifyAccessTokenEncrypted
      ? decryptAes256(merchant.shopifyAccessTokenEncrypted)
      : "";

    // 2. Generate Action
    const action = await this.aiService.buildAutomatedAction({
      incomingText: lastCustomerMsg.content,
      history: recentHistory,
      orderNameGuess: classification.extracted_order_number ?? undefined,
      customerName: customer.name || undefined,
      storeName: merchant.shopName || undefined,
      shopDomain: merchant.shopDomain,
      shopAccessToken: decryptedShopifyAccessToken,
      merchantSettings: merchant.settings,
    });

    const template = formatEmailResponse({
      customerName: customer.name || (customer.email ?? "").split("@")[0],
      aiResponse: action.messageBody,
      storeName: merchant.shopName || merchant.shopDomain.replace(".myshopify.com", ""),
      language: merchant.settings?.language || "nl",
      settings: merchant.settings,
    });

    // 3. Send and Save (Ignore guards)
    await this.messageService.create({
      conversationId: conversation.id,
      merchantId: merchant.id,
      sender: "ai",
      channel: "email",
      content: template.text,
      metadata: {
        direction: "outbound",
        intent: classification.intent,
        manual_trigger: true,
      },
    });

    if (!customer.email) throw new Error("No customer email found");

    if (merchant.googleEmail) {
      const accessToken = await getValidAccessToken(merchant);
      await sendGmailReply(accessToken, {
        to: customer.email,
        subject: conversation.subject || "Re: Your Request",
        html: template.html,
        text: template.text,
        threadId: (lastCustomerMsg.metadata as any)?.threadId || undefined,
      });
    } else {
      await sendEmailViaSes({
        to: customer.email,
        subject: conversation.subject || "Re: Your Request",
        html: template.html,
        text: template.text,
      });
    }

    // 4. Update AI resolved flag but keep status as is
    await this.conversationService.update(conversationId, {
      aiResolved: true,
    });

    return { success: true, action: action.action };
  }
}
