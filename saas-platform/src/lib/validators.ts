import { z } from "zod";

export const zMerchantId = z.uuid();
export const zShopDomain = z.string().min(3);
export const zEmail = z.email();

export const zOnboardingPayload = z.object({
  merchantName: z.string().min(2),
  shopDomain: zShopDomain,
  supportEmail: zEmail,
  step1Percentage: z.number().int().min(0).max(100),
  step2Percentage: z.number().int().min(0).max(100),
  step3Percentage: z.number().int().min(0).max(100),
});

export const zSesWebhookPayload = z.object({
  messageId: z.string().min(1),
  merchantId: zMerchantId,
  from: zEmail,
  to: zEmail,
  subject: z.string().min(1),
  textBody: z.string().min(1),
});
