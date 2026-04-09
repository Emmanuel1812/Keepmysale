import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { WebhookService } from "@/services/webhook-service";
import { getValidAccessToken, fetchNewEmails, markAsRead } from "@/lib/gmail/client";
import { MerchantsDal, mapMerchantRow } from "@/dal/merchants";
import { getEnv } from "@/lib/env";
import { apiError } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return await processGmailPolling(request);
}

export async function POST(request: Request) {
  return await processGmailPolling(request);
}

function shouldProcessEmail(email: any, merchantEmail: string) {
  // Skip als geen subject
  if (!email.subject || email.subject.trim() === "") return false;
  
  // Skip als FROM is merchant zelf
  if (email.from.toLowerCase().includes(merchantEmail.toLowerCase())) return false;
  
  // Skip bekende automated senders
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
  
  // Skip bulk subject patterns
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

async function processGmailPolling(request: Request) {
  const env = getEnv();

  // AUTH CHECK
  const isVercelCron = request.headers.get("x-vercel-cron") === "true";
  const authHeader = request.headers.get("authorization");
  const hasSecret = authHeader === `Bearer ${env.CRON_SECRET}`;

  if (!isVercelCron && !hasSecret) {
    console.error("[CRON_GMAIL] Unauthorized access attempt.");
    return apiError("UNAUTHORIZED", "Unauthorized", 401);
  }

  const supabase = createSupabaseServiceClient();
  const merchantsDal = new MerchantsDal(supabase);
  const webhookService = new WebhookService(supabase);

  try {
    // 1. Fetch all merchants with Google linked
    const { data: merchants, error } = await supabase
      .from("merchants")
      .select("*")
      .not("google_email", "is", null);

    if (error) throw error;

    let processedCount = 0;
    const summary = [];

    for (const rawMerchant of (merchants || [])) {
      const merchant = mapMerchantRow(rawMerchant as any); 
      const merchantEmail = merchant.googleEmail || "";
      
      console.log(`[CRON_GMAIL] Checking merchant: ${merchant.shopDomain} (${merchantEmail})`);

      try {
        const accessToken = await getValidAccessToken(merchant);
        const newEmails = await fetchNewEmails(accessToken);

        for (const email of newEmails) {
          console.log(`[CRON_GMAIL] Evaluating email: ${email.id} | From: ${email.from} | Subj: ${email.subject}`);

          if (!shouldProcessEmail(email, merchantEmail)) {
            console.log(`[CRON_GMAIL] Skipping automated/bulk email: ${email.subject}`);
            await markAsRead(accessToken, email.id);
            continue;
          }

          console.log(`[CRON_GMAIL] Processing legitimate email: ${email.id}`);
          
          await webhookService.handleInboundEmail({
            messageId: email.id,
            merchantId: merchant.id,
            from: email.from,
            subject: email.subject,
            textBody: email.body,
            gmailThreadId: email.threadId,
            metadata: { source: "gmail_polling" }
          });

          await markAsRead(accessToken, email.id);
          processedCount++;
        }

        summary.push({
          shop: merchant.shopDomain,
          status: "success",
          emailsFound: newEmails.length
        });
      } catch (merchantErr: any) {
        console.error(`[CRON_GMAIL] Failed for merchant ${merchant.shopDomain}:`, merchantErr);
        summary.push({
          shop: merchant.shopDomain,
          status: "error",
          error: merchantErr.message
        });
      }
    }

    return NextResponse.json({
      success: true,
      processedCount,
      merchantsChecked: summary.length,
      details: summary
    });
  } catch (err: any) {
    console.error("[CRON_GMAIL_CRITICAL_FAILURE]", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
