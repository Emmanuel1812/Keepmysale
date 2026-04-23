import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { MessagesDal } from "@/dal/messages";
import { getMerchantFromSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ messageId: string }> }
) {
  try {
    const messageId = (await params).messageId;

    let auth;
    try {
      auth = await getMerchantFromSession();
    } catch {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createSupabaseServiceClient();
    const messagesDal = new MessagesDal(supabase);

    // Verify ownership
    const message = await messagesDal.findById(messageId);
    if (!message || message.merchantId !== auth.id) {
      return NextResponse.json({ success: false, error: "Not found or unauthorized" }, { status: 404 });
    }

    // Verify it's an AI draft (security: prevent deleting customer or sent messages)
    if (message.sender !== "ai_draft") {
      return NextResponse.json({ success: false, error: "Only draft messages can be deleted" }, { status: 400 });
    }

    // Delete the message
    await messagesDal.delete(messageId);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[MESSAGES_DELETE_API_ERROR]", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
