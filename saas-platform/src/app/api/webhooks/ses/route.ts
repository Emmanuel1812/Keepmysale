import { zSesWebhookPayload } from "@/lib/validators";
import { parseSesInboundPayload } from "@/lib/ses/parser";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { apiError, apiResponse } from "@/lib/api-helpers";
import { WebhookService } from "@/services/webhook-service";

export async function POST(request: Request) {
  const rawBody = await request.text();
  let snsPayload: Record<string, unknown>;

  try {
    snsPayload = JSON.parse(rawBody);
  } catch {
    return apiError("VALIDATION_ERROR", "Invalid JSON", 400);
  }

  // Handle SNS subscription confirmation
  if (snsPayload.Type === "SubscriptionConfirmation") {
    const subscribeUrl = snsPayload.SubscribeURL as string;
    if (subscribeUrl) {
      await fetch(subscribeUrl);
    }
    return apiResponse({ confirmed: true });
  }

  console.log("[SES_WEBHOOK] Payload type:", snsPayload.Type);
  console.log("[SES_WEBHOOK] Payload keys:", Object.keys(snsPayload));
  
  if (snsPayload.Type === "Notification") {
    const rawMessage = snsPayload.Message as string;
    console.log("[SES_WEBHOOK] Message preview:", 
      rawMessage?.substring(0, 1000));
  }

  // Tijdelijk: als het een Notification is, parse 
  // het Message veld en log de structuur
  if (snsPayload.Type === "Notification" && snsPayload.Message) {
    try {
      const innerMessage = JSON.parse(snsPayload.Message as string);
      console.log("[SES_WEBHOOK] Inner message keys:", 
        Object.keys(innerMessage));
      console.log("[SES_WEBHOOK] Inner message:", 
        JSON.stringify(innerMessage).substring(0, 2000));
    } catch (e) {
      console.log("[SES_WEBHOOK] Message is not JSON:", 
        (snsPayload.Message as string)?.substring(0, 500));
    }
  }

  const parsed = zSesWebhookPayload.safeParse(snsPayload);

  if (!parsed.success) {
    console.log("[SES_WEBHOOK] Zod validation failed:", 
      JSON.stringify(parsed.error.flatten()));
    // Tijdelijk 200 om SNS retries te stoppen
    return apiResponse({ 
      debug: true, 
      zodError: parsed.error.flatten() 
    });
  }

  const inbound = parseSesInboundPayload(parsed.data);
  const supabase = createSupabaseServiceClient();
  const webhookService = new WebhookService(supabase);

  try {
    const result = await webhookService.handleSesInbound({
      messageId: inbound.messageId,
      merchantId: inbound.merchantId,
      from: inbound.from,
      subject: inbound.subject,
      textBody: inbound.textBody,
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
