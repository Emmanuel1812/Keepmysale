import { z } from "zod";

const envSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  OPENAI_API_KEY: z.string().min(1),
  AWS_SES_REGION: z.string().min(1),
  AWS_SES_ACCESS_KEY_ID: z.string().min(1),
  AWS_SES_SECRET_ACCESS_KEY: z.string().min(1),
  AWS_SES_FROM_EMAIL: z.email(),
  AWS_SNS_WEBHOOK_SECRET: z.string().min(1),
  SHOPIFY_API_KEY: z.string().min(1),
  SHOPIFY_API_SECRET: z.string().min(1),
  SHOPIFY_SCOPES: z.string().min(1),
  SHOPIFY_APP_URL: z.url(),
  MOLLIE_API_KEY: z.string().min(1),
  SHOPIFY_WEBHOOK_SECRET: z.string().min(1),
  ENCRYPTION_KEY: z.string().length(64),
});

let cachedEnv: z.infer<typeof envSchema> | null = null;

export function getEnv() {
  if (cachedEnv) return cachedEnv;

  const parsedEnv = envSchema.safeParse({
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    AWS_SES_REGION: process.env.AWS_SES_REGION,
    AWS_SES_ACCESS_KEY_ID: process.env.AWS_SES_ACCESS_KEY_ID,
    AWS_SES_SECRET_ACCESS_KEY: process.env.AWS_SES_SECRET_ACCESS_KEY,
    AWS_SES_FROM_EMAIL: process.env.AWS_SES_FROM_EMAIL,
    AWS_SNS_WEBHOOK_SECRET: process.env.AWS_SNS_WEBHOOK_SECRET,
    SHOPIFY_API_KEY: process.env.SHOPIFY_API_KEY,
    SHOPIFY_API_SECRET: process.env.SHOPIFY_API_SECRET,
    SHOPIFY_SCOPES: process.env.SHOPIFY_SCOPES,
    SHOPIFY_APP_URL: process.env.SHOPIFY_APP_URL,
    MOLLIE_API_KEY: process.env.MOLLIE_API_KEY,
    SHOPIFY_WEBHOOK_SECRET: process.env.SHOPIFY_WEBHOOK_SECRET,
    ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,
  });

  if (!parsedEnv.success) {
    throw new Error(
      `Invalid environment variables: ${JSON.stringify(parsedEnv.error.flatten().fieldErrors)}`,
    );
  }

  cachedEnv = parsedEnv.data;
  return cachedEnv;
}
