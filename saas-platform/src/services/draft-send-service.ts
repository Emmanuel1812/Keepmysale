import type { SupabaseClient } from "@supabase/supabase-js";
import { MessagesDal } from "@/dal/messages";
import { MerchantsDal } from "@/dal/merchants";
import { getValidAccessToken, sendGmailReply } from "@/lib/gmail/client";
import type { IMessage } from "@/types";

export type SendDraftResult =
  | { ok: true; message: IMessage; to: string }
  | { ok: false; code: "not_found" | "not_a_draft" | "gmail_not_connected" | "no_customer_email" | "conversation_missing"; status: number; error: string };

/**
 * Sends one AI draft to the customer from the merchant's Gmail and turns it into a sent reply.
 * Used by the inbox Send button (logged in) and by the approval link in the digest mail (signed token);
 * both have already established that `merchantId` is the caller, and this checks the draft belongs to it.
 */
export async function sendDraft(supabase: SupabaseClient, messageId: string, merchantId: string): Promise<SendDraftResult> {
  const messagesDal = new MessagesDal(supabase);
  const merchantsDal = new MerchantsDal(supabase);

  const message = await messagesDal.findById(messageId);
  if (!message || message.merchantId !== merchantId) {
    return { ok: false, code: "not_found", status: 404, error: "Not found or unauthorized" };
  }
  if (message.sender !== "ai_draft") {
    return { ok: false, code: "not_a_draft", status: 400, error: "Only drafts can be manually sent" };
  }

  const merchant = await merchantsDal.findById(message.merchantId);
  if (!merchant || !merchant.googleEmail) {
    return { ok: false, code: "gmail_not_connected", status: 400, error: "Merchant Gmail is not connected" };
  }

  const { data: convData, error: convError } = await supabase
    .from("conversations")
    .select("*, customer:customers(email)")
    .eq("id", message.conversationId)
    .single();
  if (convError || !convData) {
    return { ok: false, code: "conversation_missing", status: 500, error: "Error fetching conversation details" };
  }

  const customerEmail = convData.customer?.email;
  if (!customerEmail) {
    return { ok: false, code: "no_customer_email", status: 400, error: "Customer email not found" };
  }

  // Claim the draft before sending: of two taps (phone and laptop, or a double tap) only one gets the row,
  // so the customer never receives the same reply twice
  const { data: claimed } = await supabase
    .from("messages")
    .update({ sender: "ai" })
    .eq("id", messageId)
    .eq("sender", "ai_draft")
    .select("id");
  if (!claimed || claimed.length === 0) {
    return { ok: false, code: "not_a_draft", status: 409, error: "This draft was already sent" };
  }

  try {
    const accessToken = await getValidAccessToken(merchant);
    await sendGmailReply(accessToken, {
      to: customerEmail,
      subject: `Re: ${convData.subject || "Uw bericht"}`,
      html: message.contentHtml || message.content.replace(/\n/g, "<br />"),
      text: message.content,
      threadId: convData.external_id || undefined,
    });
  } catch (error) {
    // Not sent: give the draft back so it can be sent again
    await supabase.from("messages").update({ sender: "ai_draft" }).eq("id", messageId);
    throw error;
  }

  // A sent reply no longer carries the draft / shadow-mode markers
  const { is_fallback_draft, original_sender, shadow_mode, ...cleanMetadata } = (message.metadata ?? {}) as Record<string, unknown>;
  void is_fallback_draft; void original_sender; void shadow_mode;

  const updated = await messagesDal.update(messageId, {
    sender: "ai",
    metadata: { ...cleanMetadata, sent_by_merchant_at: new Date().toISOString() },
  });

  return { ok: true, message: updated, to: customerEmail };
}
