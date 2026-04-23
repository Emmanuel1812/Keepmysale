import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { AutomationService, SyncResult } from "@/services/automation-service";
import { MerchantsDal, mapMerchantRow } from "@/dal/merchants";
import { getValidAccessToken, sendGmailReply } from "@/lib/gmail/client";
import { getEnv } from "@/lib/env";
import { apiError } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return await processGmailPolling(request);
}

export async function POST(request: Request) {
  return await processGmailPolling(request);
}

async function processGmailPolling(request: Request) {
  const env = getEnv();

  // AUTH CHECK
  // Vercel Cron can send X-Vercel-Cron: 1 or true depending on the environment
  const isVercelCron = request.headers.get("x-vercel-cron");
  const authHeader = request.headers.get("authorization");
  const hasSecret = authHeader === `Bearer ${env.CRON_SECRET}`;
  const isDev = process.env.NODE_ENV === "development";

  if (!isVercelCron && !hasSecret && !isDev) {
    const userAgent = request.headers.get("user-agent") || "";
    // Avoid spamming logs if it's just a browser or bot hit
    if (!userAgent.includes("Mozilla")) {
      console.warn(`[CRON_GMAIL] Blocked access attempt from ${userAgent}`);
    }
    return apiError("UNAUTHORIZED", "Unauthorized", 401);
  }


  const supabase = createSupabaseServiceClient();
  const automationService = new AutomationService(supabase);

  try {
    // 1. Fetch all merchants with Google linked
    const { data: merchants, error } = await supabase
      .from("merchants")
      .select("*")
      .not("google_email", "is", null);

    if (error) throw error;

    let totalProcessed = 0;
    const summary: SyncResult[] = [];

    for (const rawMerchant of (merchants || [])) {
      const merchant = mapMerchantRow(rawMerchant as any); 
      const result = await automationService.pollMerchantEmails(merchant);
      
      totalProcessed += result.emailsProcessed;
      summary.push(result);
    }

    // 2. Process Scheduled Messages
    const { data: scheduledMessages, error: scheduleError } = await supabase
      .from("messages")
      .select("*, conversations(*, customer:customers(email))")
      .eq("is_scheduled", true)
      .lte("scheduled_send_at", new Date().toISOString())
      .order("scheduled_send_at", { ascending: true });

    if (scheduleError) {
      console.error("[CRON_GMAIL] Error fetching scheduled messages", scheduleError);
    }

    let scheduledProcessed = 0;

    for (const msg of (scheduledMessages || [])) {
      try {
        const conversation = msg.conversations;
        const customerEmail = conversation?.customer?.email;

        if (!customerEmail) {
          console.warn(`[CRON_GMAIL] Skipping scheduled msg ${msg.id}: no customer email found`);
          continue;
        }

        // Fetch the merchant separately for access token
        const { data: merchantRow } = await supabase
          .from("merchants")
          .select("*")
          .eq("id", msg.merchant_id)
          .single();

        if (!merchantRow) {
          console.warn(`[CRON_GMAIL] Skipping scheduled msg ${msg.id}: merchant not found`);
          continue;
        }

        const merchant = mapMerchantRow(merchantRow);

        if (merchant.googleEmail) {
           console.log(`[CRON_GMAIL] Sending scheduled message ${msg.id} for ${merchant.shopDomain}`);
           const accessToken = await getValidAccessToken(merchant);
           
           await sendGmailReply(accessToken, {
             to: customerEmail,
             subject: `Re: ${conversation.subject || "Uw bestelling"}`,
             html: msg.content_html || msg.content?.replace(/\n/g, "<br />") || "",
             text: msg.content || "",
             threadId: conversation.external_id,
           });
        }
        
        // Mark as processed: clear schedule flags and set sender to "ai"
        await supabase
          .from("messages")
          .update({ 
            is_scheduled: false,
            scheduled_send_at: null,
            sender: "ai", 
            metadata: { ...msg.metadata, scheduled_sent_at: new Date().toISOString() } 
          })
          .eq("id", msg.id);

        scheduledProcessed++;
      } catch (err) {
        console.error(`[CRON_GMAIL] Failed to send scheduled message ${msg.id}:`, err);
      }
    }

    return NextResponse.json({
      success: true,
      processedCount: totalProcessed,
      scheduledProcessed,
      merchantsChecked: summary.length,
      details: summary
    });
  } catch (err: any) {
    console.error("[CRON_GMAIL_CRITICAL_FAILURE]", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
