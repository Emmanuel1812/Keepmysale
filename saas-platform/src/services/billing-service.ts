import type { SupabaseClient } from "@supabase/supabase-js";
import { createMerchantSubscription } from "@/lib/mollie/client";

export class BillingService {
  constructor(private readonly supabase: SupabaseClient) {}

  async createSubscription(input: { customerId: string; amountValue: string; description: string }) {
    return createMerchantSubscription({
      customerId: input.customerId,
      amountValue: input.amountValue,
      interval: "1 month",
      description: input.description,
    });
  }
}
