import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { apiError, apiResponse } from "@/lib/api-helpers";
import { WebhookService } from "@/services/webhook-service";
import { simpleParser } from "mailparser";

export async function POST(request: Request) {
  const rawBody = await request.text();
  let snsPayload: Record<string, unknown>;

  try {
    snsPayload = JSON.parse(rawBody);
  } catch {
    return apiError("VALIDATION_ERROR", "Invalid JSON wrapper", 400);
  }

  // Handle SNS subscription confirmation
  if (snsPayload.Type === "SubscriptionConfirmation") {
    const subscribeUrl = snsPayload.SubscribeURL as string;
    if (subscribeUrl) {
      await fetch(subscribeUrl);
    }
    return apiResponse({ confirmed: true });
  }

  // Zorg dat we alleen SES Notifications verwerken
  if (snsPayload.Type !== "Notification") {
    return apiResponse({ handled: true, type: snsPayload.Type });
  }

  let sesNotification: any;
  try {
    sesNotification = JSON.parse(snsPayload.Message as string);
  } catch {
    return apiError("VALIDATION_ERROR", "SNS Message parameter block is not valid JSON", 400);
  }

  const mailNode = sesNotification?.mail;
  if (!mailNode) {
    return apiError("VALIDATION_ERROR", "Missing .mail node in SES notification", 400);
  }

  // 1. Extraheer basic fields out of AWS wrapper
  const messageId = mailNode.messageId || "unknown-id";
  const from = mailNode.source || (mailNode.commonHeaders?.from && mailNode.commonHeaders.from[0]) || "unknown-from";
  const subject = mailNode.commonHeaders?.subject || "No Subject";
  
  // 2. Parsen van de base64/raw MIME content string om human tekst te destilleren
  let textBody = "";
  if (sesNotification.content) {
    try {
      const parsedMail = await simpleParser(sesNotification.content);
      textBody = parsedMail.text || "";
    } catch (e) {
      console.error("[SES_WEBHOOK] Failed to parse MIME content via mailparser", e);
    }
  }

  // 3. Selecteer de global Merchant 
  // Omdat er (voor nu) één platform merchant is zoeken we direct diegene die ge-onboard is.
  const supabase = createSupabaseServiceClient();
  const { data: merchants, error: merchantError } = await supabase
    .from("merchants")
    .select("id")
    .eq("onboarding_completed", true)
    .limit(1);

  if (merchantError || !merchants || merchants.length === 0) {
    return apiError("NOT_FOUND", "No active merchant found for email routing", 404);
  }

  const merchantId = merchants[0].id;
  const webhookService = new WebhookService(supabase);

  // 4. Verwerk flow and call de AI / Database
  try {
    const result = await webhookService.handleInboundEmail({
      messageId,
      merchantId,
      from,
      subject,
      textBody,
    });
    return apiResponse({ handled: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unhandled webhook error";
    if (message === "Merchant not found") {
      return apiError("NOT_FOUND", message, 404);
    }
    return apiError("WEBHOOK_PROCESSING_ERROR", message, 500);
  }
}
