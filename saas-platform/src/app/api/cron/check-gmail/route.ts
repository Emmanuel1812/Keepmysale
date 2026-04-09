import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { WebhookService } from "@/services/webhook-service";
import { getValidAccessToken, fetchNewEmails, markAsRead } from "@/lib/gmail/client";
import { MerchantsDal, mapMerchantRow } from "@/dal/merchants";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return await processGmailPolling(request);
}

export async function POST(request: Request) {
  return await processGmailPolling(request);
}

async function processGmailPolling(request: Request) {
  // TODO: Add CRON_SECRET verification for security in production
  
  const supabase = createSupabaseServiceClient();
  const merchantsDal = new MerchantsDal(supabase);
  const webhookService = new WebhookService(supabase);

  const skipPatterns = [
    /noreply@/i,
    /no-reply@/i,
    /mailer-daemon@/i,
    /notifications@/i,
    /updates@/i,
    /newsletter@/i,
    /promo@/i,
    /marketing@/i,
    /@uber\.com/i,
    /@tiktok\.com/i,
    /@facebook\.com/i,
    /@facebookmail\.com/i,
  ];

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
      
      console.log(`[CRON_GMAIL] Checking merchant: ${merchant.shopDomain} (${merchant.googleEmail})`);

      try {
        const accessToken = await getValidAccessToken(merchant);
        const newEmails = await fetchNewEmails(accessToken);

        for (const email of newEmails) {
          console.log(`[CRON_GMAIL] Processing email: ${email.id} from ${email.from}`);

          // FIX 2: Skip bulk/marketing/no-reply
          const shouldSkip = skipPatterns.some((p) => p.test(email.from));
          if (shouldSkip) {
            console.log(`[CRON_GMAIL] Skipping bulk/no-reply email: ${email.from}`);
            await markAsRead(accessToken, email.id);
            continue;
          }

          // FIX 3: Check direction (not from merchant and addressed to merchant)
          const merchantEmail = merchant.googleEmail || "";
          
          if (email.from.toLowerCase().includes(merchantEmail.toLowerCase())) {
            console.log(`[CRON_GMAIL] Skipping sent/self email: ${email.from}`);
            continue; // Sent email, don't mark as read (merchant might want it unread in sent if they used inbox)
          }

          if (!email.to.toLowerCase().includes(merchantEmail.toLowerCase()) && email.from.toLowerCase() === merchantEmail.toLowerCase()) {
             // Redundant check, but following logic of "directed TO merchant"
             // Usually in:inbox covers this, but if TO is a group/alias:
          }
          
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
