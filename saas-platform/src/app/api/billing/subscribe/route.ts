import { z } from "zod";
import { apiError, apiResponse } from "@/lib/api-helpers";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { BillingService } from "@/services/billing-service";

const subscribeSchema = z.object({
  customerId: z.string().min(1),
  amountValue: z.string().min(1),
  description: z.string().min(2),
});

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = subscribeSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", "Invalid subscription payload", 400, parsed.error.flatten());
  }

  const supabase = createSupabaseServiceClient();
  const billingService = new BillingService(supabase);
  const subscription = await billingService.createSubscription(parsed.data);

  return apiResponse({ subscriptionId: subscription.id, status: subscription.status });
}
