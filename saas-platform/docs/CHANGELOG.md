# Changelog

## [0.3.0] - Live Deployment
- Added Vercel deployment configuration via `vercel.json` (`nextjs`, `pnpm install`, `pnpm build`).
- Implemented Shopify OAuth install + callback with token exchange, merchant upsert, and Supabase session cookie creation.
- Completed onboarding save flow with merchant settings persistence and post-onboarding redirect.
- Added authenticated Shopify order sync endpoint (`POST /api/shopify/sync-orders`) and onboarding-triggered sync.

## [0.2.0] - Core Pipelines
- Implemented SES inbound pipeline (`/api/webhooks/ses`) with idempotency, customer/conversation resolution, AI routing, and outbound email.
- Added AI intent classification/action generation (`gpt-4o-mini`) with regex fast-paths and multilingual responses.
- Built return negotiation engine with state transitions, offer generation, refund logging, and completion handling.
- Implemented Shopify webhook processing for `orders/*` and `fulfillments/*` topics with order upsert and tracking updates.
- Added Shopify refund execution flow and negotiation completion integration.
- Added test coverage for end-to-end pipeline, Shopify webhook flows, and refund execution (`13/13` passing).

## [0.1.0] - Foundation
- Added Supabase schema foundation in 10 SQL migrations:
  - merchants, customers, conversations, messages, orders, negotiations, refund_logs, knowledge_base
  - RLS policies/triggers/functions
  - negotiation offer append RPC
- Added typed domain model files under `src/types` (merchant/customer/conversation/message/order/negotiation/refund/ai/api/shopify/bird/ses/domain/index).
- Implemented layered architecture:
  - DAL per table (`src/dal`)
  - service layer (`src/services`)
  - adapter/util layer (`src/lib`)
  - API route layer (`src/app/api`)
- Added auth/security primitives:
  - session-based merchant resolution (`getMerchantFromSession`)
  - resource ownership checks (`assertOwnership`)
  - AES-256 token encryption/decryption
  - Supabase RLS-enabled tenant isolation
