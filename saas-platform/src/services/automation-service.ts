import { SupabaseClient } from "@supabase/supabase-js";
import { WebhookService } from "@/services/webhook-service";
import { getValidAccessToken, fetchNewEmails, markAsRead } from "@/lib/gmail/client";
import type { IMerchant } from "@/types";

export interface SyncResult {
  shopDomain: string;
  status: "success" | "error";
  emailsProcessed: number;
  emailsFound: number;
  error?: string;
}

export class AutomationService {
  private readonly webhookService: WebhookService;

  constructor(private readonly supabase: SupabaseClient) {
    this.webhookService = new WebhookService(supabase);
  }

  async pollMerchantEmails(merchant: IMerchant): Promise<SyncResult> {
    const merchantEmail = merchant.googleEmail || "";
    console.log(`[AutomationService] Poll starting for: ${merchant.shopDomain} (${merchantEmail})`);

    try {
      const accessToken = await getValidAccessToken(merchant);
      const newEmails = await fetchNewEmails(accessToken);
      let processedCount = 0;

      for (const email of newEmails) {
        if (!this.shouldProcessEmail(email, merchantEmail)) {
          console.log(`[AutomationService] Skipping automated/bulk email: ${email.subject}`);
          await markAsRead(accessToken, email.id);
          continue;
        }

        console.log(`[AutomationService] Processing email: ${email.id} from ${email.from}`);
        
        await this.webhookService.handleInboundEmail({
          messageId: email.id,
          merchantId: merchant.id,
          from: email.from,
          subject: email.subject,
          textBody: email.body,
          gmailThreadId: email.threadId,
          metadata: { source: "automation_service_poll" }
        });

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

  private shouldProcessEmail(email: any, merchantEmail: string): boolean {
    if (!email.subject || email.subject.trim() === "") return false;
    if (email.from.toLowerCase().includes(merchantEmail.toLowerCase())) return false;
    
    const skipDomains = [
      "noreply", "no-reply", "mailer-daemon",
      "notifications", "newsletter", "promo",
      "marketing", "updates", "support@shopify",
      "uber.com", "tiktok.com", "facebook.com",
      "facebookmail.com", "instagram.com", 
      "twitter.com", "linkedin.com", "pinterest.com",
      "google.com", "amazonaws.com", "aws.amazon.com",
      "klaviyo.com", "mailchimp.com", "sendgrid.net",
      "netlify.com", "vercel.com", "github.com",
      "belastingdienst", "mollie.com", "stripe.com",
      "paypal.com", "bank", "payment",
    ];
    
    const fromLower = email.from.toLowerCase();
    if (skipDomains.some(d => fromLower.includes(d))) return false;
    
    const bulkSubjects = [
      /automatic reply/i,
      /auto-?reply/i,
      /out of office/i,
      /unsubscribe/i,
      /inkomstenbelasting/i,
      /your (account|projects?|subscription)/i,
      /billing/i,
      /verify your/i,
      /welcome to/i,
      /setup success/i,
      /\d+% (off|korting)/i,
      /free (shipping|trial)/i,
      /last chance/i,
      /limited time/i,
      /buy \d+.*get \d+/i,
      /suspended/i,
      /credit limit/i,
    ];
    
    if (bulkSubjects.some(p => p.test(email.subject))) return false;
    
    return true;
  }
}
