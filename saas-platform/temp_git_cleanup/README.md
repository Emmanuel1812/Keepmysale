# KeepMySale

> "AI helpdesk die tickets afhandelt EN retouren voorkomt voor Shopify merchants"

KeepMySale is een grootschalig B2B SaaS platform ontworpen om de return-frictie bij Shopify verkopers te verpulveren. Via artificial intelligence die reageert op inkomende klant-emails, analyseert de engine de intentie van de klant (retourverzoek) en initieert deze volledig autonoom dynamische State Machine onderhandelingen. In drie gerobotiseerde escalatie-stappen (partial refund, store credit, omruiling) kaapt hij de vergaande omzetten terug uit de klauwen van een volledige retour.

## Technology Stack
- **Framework:** Next.js 14, React Serverside Components, App Router
- **Language:** TypeScript
- **Database / Auth:** Supabase (PostgresSQL + Magic Link OTP auth)
- **AI Engine:** OpenAI (gpt-4o-mini intent classifier)
- **Inbound Comms:** Amazon Web Services (SES + SNS webhook proxy)
- **E-Commerce:** Shopify API (GraphQL + Webhooks + OAuth flow)
- **Billing:** Mollie API
- **Deployment:** Vercel
- **Package Manager:** pnpm

## Prerequisites
Controleer voor setup dat de volgende technologieën in locale cache zitten:
- Node.js 18+
- pnpm (package manager)
- Een geactiveerd Supabase instance
- Shopify Partner Development store

## Setup Instructions

```bash
# Clone the repository
git clone [repository_url]
cd saas-platform

# Install dependencies using pnpm explicitly
pnpm install

# Copy environment variables skeleton
cp .env.example .env.local

# Voer migraties uit en start supabase connectie
# Vul .env.local met juiste credential parameters
```

## Environment Variables
Voor core functionering moet `.env.local` volledig over de volgende constructie beschikken:

| Environment Variabele | Beschrijving | Waar te vinden |
|-------------------------|--------------|----------------|
| `NEXT_PUBLIC_APP_URL` | De live/local base URL voor redirect | App Setup |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Postgres gateway URL | Supabase Dashboard |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public access key API | Supabase Auth settings |
| `SUPABASE_SERVICE_ROLE_KEY` | Secure admin access (voor webhooks) | Supabase API configuratie |
| `OPENAI_API_KEY` | Connectiekey API | OpenAI Developer Dashboard |
| `AWS_SES_REGION` | Regio van outbound mails (`eu-west-1`) | AWS Console |
| `AWS_SES_ACCESS_KEY_ID` | Amazon policy auth key | AWS IAM |
| `AWS_SES_SECRET_ACCESS_KEY` | Amazon policy secret key | AWS IAM |
| `AWS_SES_FROM_EMAIL` | Afzender support email voor replies | AWS Verified Identities |
| `AWS_SNS_WEBHOOK_SECRET` | Auth secret om inbound payloads te un-gate | AWS SNS Dashboard |
| `SHOPIFY_API_KEY` | Public app key voor specifieke shop | Shopify Partners App |
| `SHOPIFY_API_SECRET` | Backend Shopify key voor access exchanges | Shopify Partners App |
| `SHOPIFY_SCOPES` | e.g. `read_orders,write_orders...` | Shopify Configuration |
| `SHOPIFY_APP_URL` | URL match configuration. Gelijk aan NEXT URL | App Bridge settings |
| `SHOPIFY_WEBHOOK_SECRET` | Payload authenticatie per-shop configuratie | Shopify App |
| `MOLLIE_API_KEY` | Live / test licentie key voor onboarding payments | Mollie Dashboard |
| `ENCRYPTION_KEY` | Exact 64-karakter string voor AES-256 token encryptie | Local generation |

## Database Setup
1. Creeer of start je locale Supabase project: `supabase start`
2. Run database migrations gelokaliseerd in de map `/supabase/migrations/`
3. Push via: `supabase db push` (of run queries manueel in het SQL dashboard). Let op dat `010_negotiation_offer_rpc.sql` correct is aangeslagen.

## Scripts & Commando's
- `pnpm dev` → Start Next.js development server (localhost)
- `pnpm build` → Start optimalisatie naar de productieschijf (Vercel run-alike)
- `pnpm test` → Start de Vitest / E2E mock integratie tests  
- `pnpm lint` → Evalueert en normaliseert code styling  
- `pnpm typecheck` → Voert tsc zero-emit TypeScript validation run uit

## Structuur
- `/src/app/api/` → Volledig ingerichte Next Server API route controllers & webhooks
- `/src/components/` → Shadcn styling hooks en visuele React Dashboard elementen
- `/src/dal/` → Database Access Layer (strict filter logica m.b.t Supabase querying)
- `/src/services/` → Abstracte business rules, AI logic proxy allocatie
- `/src/lib/` → Externe SDK instanties & validators (Zod/OpenAI/Auth sessies)
- `/src/types/` → Strikte database row mapping interface exports  
- `/src/hooks/` → React statemanagement helpers en UI wrappers  
- `/src/config/` → Site-wide metadata, themeroutes en standaard constanten  
- `/supabase/` → Alle SQL migratiefiles om database tables, joins en RPC routines af te dwingen  
- `/docs/` → Uitgebreide documentatie over AI implementaties en abstracte Architectuur flows

## Deployment
Dit project draait native op **Vercel** (`vercel.json` aanwezig) als Edge netwerk. Zodra master commits via Github op de repo vallen, triggert een Vercel hook automatisch de deploy pipelines, controleert de TypeScript code op corruptie, en stuurt deze naar edge servers live uit.

---
**License**: Proprietary (Closed-Source)
