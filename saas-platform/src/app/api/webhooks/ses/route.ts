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

  const parsed = zSesWebhookPayload.safeParse(snsPayload);

  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", "Invalid SES webhook payload", 400, parsed.error.flatten());
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
