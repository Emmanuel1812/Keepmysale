import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { verifyApprovalToken } from "@/lib/automation/draft-approval";
import { sendDraft } from "@/services/draft-send-service";

export const dynamic = "force-dynamic";

/**
 * The Send button on /approve/<token>. The signed token is the authority (it names the draft and its merchant);
 * sendDraft checks the draft still belongs to that merchant and claims it, so a second press cannot send twice.
 * Always answers with a redirect back to the page, which shows the outcome.
 */
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const back = (status: string) =>
    NextResponse.redirect(new URL(`/approve/${encodeURIComponent(token)}?status=${status}`, request.url), 303);

  const claim = verifyApprovalToken(token);
  if (!claim) return back("expired");

  try {
    const result = await sendDraft(createSupabaseServiceClient(), claim.messageId, claim.merchantId);
    if (result.ok) return back("sent");
    return back(result.code === "not_a_draft" ? "already" : "error");
  } catch (error) {
    console.error("[APPROVE_SEND_ERROR]", error);
    return back("error");
  }
}
