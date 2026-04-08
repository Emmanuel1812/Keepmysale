# Changelog

## [0.3.0] - Live Deployment & Dashboard
### Added
- Vercel deployment (keepmysale.vercel.app)
- Shopify OAuth complete flow (install → callback → session)
- Onboarding with return rules configuration
- Dashboard overview with order stats + revenue
- Orders sync from Shopify with tracking data
- Settings page with negotiation configuration
- Sidebar navigation (Overview, Inbox, Orders, Returns, Settings)
- Status badges (Paid, Fulfilled)
- Shopify webhook registration after OAuth
- Self-healing token reconnect flow

## [0.2.0] - Core Pipelines & Testing
### Added
- SES inbound email pipeline (13-step flow)
- AI intent classification (OpenAI gpt-4o-mini)
- Return negotiation engine (3-step escalating offers)
- Shopify webhook processing (orders + fulfillments)
- Shopify auto-refund execution
- E2E tests (13/13 passed on real Supabase)

## [0.1.0] - Foundation
### Added
- Database schema (10 migrations, 8 tables, RLS)
- TypeScript type definitions (13 files)
- Data access layer (8 DAL files with mapRow)
- Service layer (12 services)
- API routes (11 routes with Zod + session + ownership)
- Auth system (Supabase cookie auth + AES-256 encryption)
- Frontend foundation (dashboard layout, inbox, onboarding)
