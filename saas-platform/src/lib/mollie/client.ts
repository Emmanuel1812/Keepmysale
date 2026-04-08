import createMollieClient from "@mollie/api-client";
import { getEnv } from "@/lib/env";

export async function createMerchantSubscription(params: {
  customerId: string;
  amountValue: string;
  interval: "1 month";
  description: string;
}) {
  const env = getEnv();
  const mollieClient = createMollieClient({ apiKey: env.MOLLIE_API_KEY });
  return mollieClient.customerSubscriptions.create({
    customerId: params.customerId,
    amount: {
      currency: "EUR",
      value: params.amountValue,
    },
    interval: params.interval,
    description: params.description,
  });
}
