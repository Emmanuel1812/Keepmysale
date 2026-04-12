import { SupabaseClient } from "@supabase/supabase-js";
import { WebhookService } from "@/services/webhook-service";
import { getValidAccessToken, fetchNewEmails, markAsRead } from "@/lib/gmail/client";
import type { IMerchant } from "@/types";
import { EmailFilterService } from "@/lib/services/email-filter";

export interface SyncResult {
  shopDomain: string;
  status: "success" | "error";
  emailsProcessed: number;
  emailsFound: number;
  error?: string;
}

export class AutomationService {
  private readonly webhookService: WebhookService;
  private readonly emailFilter: EmailFilterService;

  constructor(private readonly supabase: SupabaseClient) {
    this.webhookService = new WebhookService(supabase);
    this.emailFilter = new EmailFilterService(supabase);
  }

  async pollMerchantEmails(merchant: IMerchant): Promise<SyncResult> {
    const merchantEmail = merchant.googleEmail || "";
    console.log(`[AutomationService] Poll starting for: ${merchant.shopDomain} (${merchantEmail})`);

    try {
      const accessToken = await getValidAccessToken(merchant);
      const newEmails = await fetchNewEmails(accessToken);
      let processedCount = 0;

      for (const email of newEmails) {
        // Pass headers for Layer 3 filtering
        const filterResult = await this.emailFilter.shouldProcessEmail(
          email, 
          email.headers || [], 
          merchant.id
        );
        
        if (!filterResult.shouldProcess) {
          console.log(`[AutomationService] SKIPPED (L${filterResult.layer}): ${email.subject} | From: ${email.from} | Reason: ${filterResult.reason}`);
          await markAsRead(accessToken, email.id);
          continue;
        }

        console.log(`[AutomationService] ALLOWED (L${filterResult.layer}): ${email.subject} | From: ${email.from} | Reason: ${filterResult.reason}`);
        
        const automationResult = await this.webhookService.handleInboundEmail({
          messageId: email.id,
          merchantId: merchant.id,
          from: email.from,
          subject: email.subject,
          textBody: email.body,
          gmailThreadId: email.threadId,
          metadata: { source: "automation_service_poll" }
        });
        
        console.log(`[AutomationService] Automation Result for ${email.id}:`, automationResult.action);

        await markAsRead(accessToken, email.id);
        processedCount++;
      }

      return {
        shopDomain: merchant.shopDomain,
        status: "success",
        emailsProcessed: processedCount,
        emailsFound: newEmails.length
      };
    } catch (err: any) {
      console.error(`[AutomationService] Error polling ${merchant.shopDomain}:`, err);
      return {
        shopDomain: merchant.shopDomain,
        status: "error",
        emailsProcessed: 0,
        emailsFound: 0,
        error: err.message
      };
    }
  }

}
