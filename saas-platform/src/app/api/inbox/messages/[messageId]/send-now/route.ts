import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { MessagesDal } from "@/dal/messages";
import { getMerchantFromSession } from "@/lib/auth";
import { MerchantsDal } from "@/dal/merchants";
import { getValidAccessToken, sendGmailReply } from "@/lib/gmail/client";

export const dynamic = "force-dynamic";

export async function POST(
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
    const merchantsDal = new MerchantsDal(supabase);

    // Verify ownership
    const message = await messagesDal.findById(messageId);
    if (!message || message.merchantId !== auth.id) {
      return NextResponse.json({ success: false, error: "Not found or unauthorized" }, { status: 404 });
    }

    // Must be a scheduled message or raw AI tracking original scheduled.
    const isAiScheduled = message.isScheduled === true || message.sender === ("ai_scheduled" as any) || message.metadata?.original_sender === "ai_scheduled";
    
    if (!isAiScheduled) {
      return NextResponse.json({ success: false, error: "Only explicitly scheduled messages can be dispatched early" }, { status: 400 });
    }

    // Load Merchant
    const merchant = await merchantsDal.findById(message.merchantId);
    if (!merchant || !merchant.googleEmail) {
       return NextResponse.json({ success: false, error: "Merchant Gmail is not connected" }, { status: 400 });
    }

    // Load Conversation and Customer details directly
    const { data: convData, error: convError } = await supabase
      .from("conversations")
      .select("*, customer:customers(email)")
      .eq("id", message.conversationId)
      .single();

    if (convError || !convData) {
      return NextResponse.json({ success: false, error: "Error fetching conversation details" }, { status: 500 });
    }

    const customerEmail = convData.customer?.email;
    if (!customerEmail) {
      return NextResponse.json({ success: false, error: "Customer email not found" }, { status: 400 });
    }

    // Dispatch via Gmail
    const accessToken = await getValidAccessToken(merchant);
    await sendGmailReply(accessToken, {
        to: customerEmail,
        subject: `Re: ${convData.subject || "Uw bericht"}`,
        html: message.contentHtml || message.content.replace(/\n/g, "<br />"),
        text: message.content,
        threadId: convData.external_id || undefined,
    });

    // Strip shadow modes / Draft dependencies natively out of metadata
    const { is_fallback_draft, original_sender, shadow_mode, ...cleanMetadata } = message.metadata as any;

    // Update Message clearing schedule details cleanly!
    const updated = await messagesDal.update(messageId, {
       sender: "ai",
       isScheduled: false,
       metadata: cleanMetadata
    });
    
    // Explicitly nullify scheduledSendAt via raw postgres since dal mapping might strictly ignore nested nulls cleanly
    await supabase.from("messages").update({ scheduled_send_at: null }).eq("id", messageId);

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    console.error("[MESSAGES_SEND_NOW_API_ERROR]", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
