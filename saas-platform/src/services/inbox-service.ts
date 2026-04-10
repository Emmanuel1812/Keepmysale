import type { SupabaseClient } from "@supabase/supabase-js";
import { ConversationService } from "@/services/conversation-service";
import { MessageService } from "@/services/message-service";
import { CustomerService } from "@/services/customer-service";
import { MerchantService } from "@/services/merchant-service";
import { sendEmailViaSes } from "@/lib/ses/client";
import { formatEmailResponse } from "@/lib/email/template";

export class InboxService {
  private readonly conversationService: ConversationService;
  private readonly messageService: MessageService;
  private readonly customerService: CustomerService;
  private readonly merchantService: MerchantService;

  constructor(private readonly supabase: SupabaseClient) {
    this.conversationService = new ConversationService(supabase);
    this.messageService = new MessageService(supabase);
    this.customerService = new CustomerService(supabase);
    this.merchantService = new MerchantService(supabase);
  }

  getConversationMessages(conversationId: string) {
    return this.messageService.findByConversation(conversationId);
  }

  async sendReply(params: { conversationId: string; merchantId: string; content: string }) {
    const conversation = await this.conversationService.findById(params.conversationId);
    if (!conversation) throw new Error("Conversation not found");

    const customer = await this.customerService.findById(conversation.customerId);
    const merchant = await this.merchantService.findById(params.merchantId);
    if (!merchant) throw new Error("Merchant not found");

    const savedMessage = await this.messageService.create({
      conversationId: params.conversationId,
      merchantId: params.merchantId,
      sender: "human_agent",
      channel: conversation.channel,
      content: params.content,
      metadata: { source: "inbox_reply_api" },
    });

    if (conversation.channel === "email" && customer?.email) {
      const template = formatEmailResponse({
        customerName: customer.firstName || "klant",
        body: params.content,
        storeName: merchant.shopDomain.replace(".myshopify.com", ""),
        supportEmail: merchant.googleEmail || merchant.email || "support@" + merchant.shopDomain,
      });

      await sendEmailViaSes({
        to: customer.email,
        subject: conversation.subject ? `Re: ${conversation.subject}` : "Support update",
        html: template.html,
        text: template.text,
      });
    }

    return savedMessage;
  }
}
