import { apiError, apiResponse } from "@/lib/api-helpers";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { WebhookService } from "@/services/webhook-service";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const hmac = request.headers.get("x-shopify-hmac-sha256");
  const topic = request.headers.get("x-shopify-topic");
  const shopDomain = request.headers.get("x-shopify-shop-domain");
  const supabase = createSupabaseServiceClient();
  const webhookService = new WebhookService(supabase);

  try {
    const result = await webhookService.handleShopifyWebhook(rawBody, hmac, { topic, shopDomain });
    return apiResponse(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid Shopify webhook";
    return apiError("UNAUTHORIZED", message, 401);
  }
}
