# ReturnShield SaaS Platform

Email-first Shopify support automation SaaS built with Next.js, Supabase, and OpenAI.

## Tech Stack
- Next.js 16 (App Router), React 19, TypeScript
- Supabase (`@supabase/supabase-js`, `@supabase/ssr`) for Postgres + auth
- AWS SES/SNS SDKs for email channel integrations
- Shopify Admin API integrations (OAuth, orders, refunds, webhooks)
- OpenAI (`gpt-4o-mini`) for intent classification and automated actions
- Mollie client integration for billing
- Zod validation, Vitest tests, ESLint

## Prerequisites
- Node.js 18+
- `pnpm`
- Supabase project/account
- Shopify Partner app credentials
- AWS SES credentials
- OpenAI API key

## Setup
```bash
git clone <your-repo-url>
cd saas-platform
pnpm install
cp .env.example .env.local
pnpm dev
```

### Required Environment Variables
Copy from `.env.example` and set real values:

- `NEXT_PUBLIC_APP_URL` -> your app URL (local: `http://localhost:3000`)
- `NEXT_PUBLIC_SUPABASE_URL` -> Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` -> Supabase anon key
- `SUPABASE_SERVICE_ROLE_KEY` -> Supabase service role key
- `OPENAI_API_KEY` -> OpenAI dashboard API key
- `AWS_SES_REGION` -> AWS SES region
- `AWS_SES_ACCESS_KEY_ID` -> AWS IAM access key
- `AWS_SES_SECRET_ACCESS_KEY` -> AWS IAM secret key
- `AWS_SES_FROM_EMAIL` -> verified SES sender email
- `AWS_SNS_WEBHOOK_SECRET` -> internal webhook secret value
- `SHOPIFY_API_KEY` -> Shopify app API key
- `SHOPIFY_API_SECRET` -> Shopify app API secret
- `SHOPIFY_SCOPES` -> OAuth scopes for your app
- `SHOPIFY_APP_URL` -> public app base URL
- `SHOPIFY_WEBHOOK_SECRET` -> Shopify webhook signing secret
- `MOLLIE_API_KEY` -> Mollie API key
- `ENCRYPTION_KEY` -> 64-char hex key for AES-256 token encryption

## Database Setup (Supabase)
Run SQL migrations in order from `supabase/migrations`:

1. `001_create_merchants.sql`
2. `002_create_customers.sql`
3. `003_create_conversations.sql`
4. `004_create_messages.sql`
5. `005_create_orders.sql`
6. `006_create_negotiations.sql`
7. `007_create_refund_logs.sql`
8. `008_create_knowledge_base.sql`
9. `009_create_rls_policies.sql`
10. `010_negotiation_offer_rpc.sql`

Use Supabase SQL Editor or migration tooling in that sequence.

## Useful Commands
```bash
pnpm dev
pnpm build
pnpm test
pnpm lint
pnpm typecheck
```

## Folder Structure
- `src/app` -> Next.js app routes, pages, and API route handlers
- `src/components` -> UI and feature components
- `src/services` -> business orchestration layer
- `src/dal` -> database access layer (Supabase queries only)
- `src/lib` -> adapters/utilities (Shopify, SES, OpenAI, auth, encryption)
- `src/types` -> shared domain/API type definitions
- `src/tests` -> integration/service tests
- `supabase/migrations` -> schema, RLS, triggers, and SQL functions
- `docs` -> architecture and operational documentation

## Deployment (Vercel)
- `vercel.json` is configured with:
  - `framework: nextjs`
  - `installCommand: pnpm install`
  - `buildCommand: pnpm build`
- Add the same environment variables from `.env.local` in Vercel Project Settings.
- Deploy preview/prod with Vercel CLI or Git integration.
