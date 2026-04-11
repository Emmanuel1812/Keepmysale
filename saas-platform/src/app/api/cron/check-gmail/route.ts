import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { AutomationService, SyncResult } from "@/services/automation-service";
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

async function processGmailPolling(request: Request) {
  const env = getEnv();

  // AUTH CHECK
  // Vercel Cron can send X-Vercel-Cron: 1 or true depending on the environment
  const isVercelCron = request.headers.get("x-vercel-cron");
  const authHeader = request.headers.get("authorization");
  const hasSecret = authHeader === `Bearer ${env.CRON_SECRET}`;

  if (!isVercelCron && !hasSecret) {
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

    return NextResponse.json({
      success: true,
      processedCount: totalProcessed,
      merchantsChecked: summary.length,
      details: summary
    });
  } catch (err: any) {
    console.error("[CRON_GMAIL_CRITICAL_FAILURE]", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
