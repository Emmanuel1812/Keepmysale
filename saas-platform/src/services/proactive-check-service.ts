import { SupabaseClient } from "@supabase/supabase-js";
import { MerchantsDal } from "@/dal/merchants";
import { OrdersDal } from "@/dal/orders";
import { AiService } from "@/services/ai-service";
import { MessageService } from "@/services/message-service";
import { ConversationService } from "@/services/conversation-service";
import { sendEmailViaSes } from "@/lib/ses/client";
import { formatEmailResponse } from "@/lib/utils/email-formatter";
import { subDays } from "date-fns";

export class ProactiveCheckService {
  private readonly merchantsDal: MerchantsDal;
  private readonly ordersDal: OrdersDal;
  private readonly aiService: AiService;
  private readonly messageService: MessageService;
  private readonly conversationService: ConversationService;

  constructor(private readonly supabase: SupabaseClient) {
    this.merchantsDal = new MerchantsDal(supabase);
    this.ordersDal = new OrdersDal(supabase);
    this.aiService = new AiService(supabase);
    this.messageService = new MessageService(supabase);
    this.conversationService = new ConversationService(supabase);
  }

  async processAllMerchants() {
    console.log("[ProactiveCheckService] Starting scan...");
    
    // Fetch all merchants (filtering JSONB settings via JS for safety/simplicity in this stack)
    const { data: merchants, error } = await this.supabase.from("merchants").select("*");
    if (error) throw error;

    for (const rawMerchant of merchants) {
      const merchant = new MerchantsDal(this.supabase).findById(rawMerchant.id);
      // Wait, I can just map them
    }

    // Better approach: use the DAL
    const allMerchants = await this.supabase.from("merchants").select("id");
    if (!allMerchants.data) return;

    for (const m of allMerchants.data) {
      const merchant = await this.merchantsDal.findById(m.id);
      if (!merchant || !merchant.settings?.proactive_check_enabled) continue;

      await this.processMerchantOrders(merchant);
    }
  }

  private async processMerchantOrders(merchant: any) {
    const twoDaysAgo = subDays(new Date(), 2).toISOString();
    
    // Find delivered orders that haven't had a check sent yet
    const { data: eligibleOrders, error } = await this.supabase
      .from("orders")
      .select("*")
      .eq("merchant_id", merchant.id)
      .eq("proactive_check_sent", false)
      .eq("fulfillment_status", "delivered") // or whatever status Shopify webhooks set
      .lt("delivered_at", twoDaysAgo);

    if (error) {
      console.error(`[ProactiveCheckService] Error fetching orders for ${merchant.shopDomain}:`, error);
      return;
    }

    console.log(`[ProactiveCheckService] Found ${eligibleOrders?.length || 0} eligible orders for ${merchant.shopDomain}`);

    for (const order of eligibleOrders || []) {
      try {
        await this.sendProactiveCheck(merchant, order);
      } catch (err) {
        console.error(`[ProactiveCheckService] Failed to send check for order ${order.shopify_order_number}:`, err);
      }
    }
  }

  private async sendProactiveCheck(merchant: any, order: any) {
    console.log(`[ProactiveCheckService] Sending proactive check for order ${order.shopify_order_number}`);

    // 1. Create a conversation if it doesn't exist
    let conversationId: string;
    const { data: existingConv } = await this.supabase
      .from("conversations")
      .select("id")
      .eq("customer_id", order.customer_id)
      .eq("merchant_id", merchant.id)
      .limit(1)
      .maybeSingle();

    if (existingConv) {
      conversationId = existingConv.id;
    } else {
      const conv = await this.conversationService.create({
        merchantId: merchant.id,
        customerId: order.customer_id,
        subject: `How was your order ${order.shopify_order_number}?`,
        channel: "email",
        status: "open",
      });
      conversationId = conv.id;
    }

    // 2. Generate Content via AI
    const prompt = `Generate a very brief, friendly follow-up email for a customer who just received their order (${order.shopify_order_number}). 
    Ask if everything arrived in good condition and if they are happy with the products.
    Store Name: ${merchant.shopName || merchant.shop_domain}
    Tone: ${merchant.settings.tone || 'friendly'}
    Language: ${merchant.settings.language || 'nl'}`;

    const aiAction = await this.aiService.buildAutomatedAction({
      incomingText: "SYSTEM_GENERATE_PROACTIVE_CHECK",
      customerName: "Customer", // Ideally fetch from customer DAL
      storeName: merchant.shopName || merchant.shopDomain,
      shopDomain: merchant.shopDomain,
      shopAccessToken: "", // Not needed for general reply
      merchantSettings: merchant.settings,
    });

    // 3. Format & Send
    const template = formatEmailResponse({
      customerName: null,
      aiResponse: aiAction.messageBody,
      storeName: merchant.shopName || merchant.shopDomain,
      language: merchant.settings.language || "nl",
      settings: merchant.settings,
    });

    // 4. Send Email
    if (order.email) {
      await sendEmailViaSes({
        to: order.email,
        subject: `Feedback gezocht: Je bestelling bij ${merchant.shopName || merchant.shopDomain}`,
        html: template.html,
        text: template.text,
      });
    }

    // 5. Save Message
    await this.messageService.create({
      conversationId,
      merchantId: merchant.id,
      sender: "ai",
      channel: "email",
      content: aiAction.messageBody,
      metadata: { proactive: true },
    });

    // 6. Mark Order
    await this.ordersDal.update(order.id, { proactiveCheckSent: true });
  }
}
