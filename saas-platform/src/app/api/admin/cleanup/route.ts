import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret");

  // Simple protection for admin route
  // In production, you would use a real admin session or environment variable secret
  if (process.env.NODE_ENV === "production" && secret !== process.env.ADMIN_SECRET) {
     return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createSupabaseServiceClient();

  const spamKeywords = [
    "Welcome to AWS",
    "DKIM setup",
    "Instagram",
    "Buy 1, get 1 free",
    "billing information",
    "surprise guest",
    "Kopy",
    "Verify your",
    "Subscription",
    "Sale ends",
  ];

  try {
    let totalDeleted = 0;

    for (const keyword of spamKeywords) {
      const { count, error } = await supabase
        .from("conversations")
        .delete({ count: "exact" })
        .ilike("subject", `%${keyword}%`);
      
      if (error) {
        console.error(`Error deleting keyword ${keyword}:`, error);
      } else {
        totalDeleted += count || 0;
      }
    }

    return NextResponse.json({
      success: true,
      message: "Spam cleanup completed",
      deletedCount: totalDeleted,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
