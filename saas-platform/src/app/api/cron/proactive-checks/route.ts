import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { ProactiveCheckService } from "@/services/proactive-check-service";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // Same rule as check-gmail: no secret configured means nobody gets in
  if (process.env.NODE_ENV === "production" && !isAuthorizedCronRequest(request, process.env.CRON_SECRET)) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const supabase = createSupabaseServiceClient();
    const service = new ProactiveCheckService(supabase);
    
    await service.processAllMerchants();
    
    return NextResponse.json({ success: true, message: "Proactive checks processed" });
  } catch (error: any) {
    console.error("[CRON ProactiveChecks] Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
