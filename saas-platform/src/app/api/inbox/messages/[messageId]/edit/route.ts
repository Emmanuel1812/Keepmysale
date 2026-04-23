import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { MessagesDal } from "@/dal/messages";
import { getMerchantFromSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ messageId: string }> } // Follow Next.js 16 dynamic route params
) {
  try {
    const messageId = (await params).messageId;
    const body = await request.json();
    const newContent = body.content as string;

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

    // Verify it's an AI draft
    if (message.sender !== "ai_draft") {
      return NextResponse.json({ success: false, error: "Only draft messages can be edited" }, { status: 400 });
    }

    if (!newContent || newContent.trim() === "") {
        return NextResponse.json({ success: false, error: "Content cannot be empty" }, { status: 400 });
    }

    // Update the message content
    const updated = await messagesDal.update(messageId, {
      content: newContent,
      // Clear auto-generated HTML so it forces frontend re-format or just set plain text if the system processes UI display safely.
      contentHtml: newContent.replace(/\n/g, "<br />")
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    console.error("[MESSAGES_EDIT_API_ERROR]", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
