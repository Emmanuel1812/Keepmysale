# System Architecture

## Overview

```text
┌──────────┐     ┌─────────┐     ┌───────────┐
│ Customer │────→│ AWS SES │────→│ Webhook   │
│ (email)  │     │         │     │ Pipeline  │
└──────────┘     └─────────┘     └─────┬─────┘
                                       │
                                 ┌─────▼─────┐
                                 │ AI Engine │
                                 │ (OpenAI)  │
                                 └─────┬─────┘
                                       │
┌──────────┐     ┌─────────┐     ┌─────▼─────┐
│ Shopify  │────→│Webhooks │────→│ Services  │
│ Store    │     │         │     │ Layer     │
└──────────┘     └─────────┘     └─────┬─────┘
                                       │
┌──────────┐     ┌─────────┐     ┌─────▼─────┐
│ Merchant │────→│ Next.js │────→│ Supabase  │
│ Browser  │     │ App     │     │ Postgres  │
└──────────┘     └─────────┘     └───────────┘
```

## Architectuur Lagen

Het applicatie patroon is strict functioneel opgezet om tight-coupling te voorkomen. 
1. **Frontend**: Next.js (App Router, Server + Client components). Geen database calls worden hier direct gemaakt behalve door via /api/ of via secure Server Actions te routeren, of view-only getMerchant.
2. **API Routes (/api/)**: Controller laag. Verifieert sessies en Zod input validation bodies. Accepteert/weigert netwerk en spreekt vervolgens altijd een Service aan.
3. **Services Sector (/services/)**: Business Logic Laag. Krijgen verzoeken ge-injected (vaak inclusief de merchant ID), bevatten alle beslisbomen, rekenen averages uit, communiceren met externe endpoints (Shopify, OpenAI, SES) en sluiten hun logica af door de Data Access Layer in te lichten.
4. **Data Access Layer (/dal/)**: Interface naar de Postgres database (Supabase Client). Hier is geen logica. De DAL schrijft, leest `single()`, filtert en mapRowt data netjes terug in vaste typescript Interfaces (`IMerchant`, `IOrder`).
5. **Database**: Supabase Postgres uitgerust met Row Level Security (RLS) policies.

## Database Schema

Gebaseerd op de 10 Supabase migraties onder `/supabase/migrations`.

### merchants
| Kolom | Type | Beschrijving |
|---|---|---|
| id | uuid (PK) | Unieke ID per winkel / licentie |
| supabase_user_id | uuid (FK) | Gekoppeld aan auth.users |
| shop_domain | varchar | Shopify identifier. Uniek. |
| shop_name | varchar | Naam van merchant overzicht |
| email | varchar | Support e-mail / notificatie mail |
| shopify_access_token_encrypted | text | AES-256 encrypted app key |
| subscription_tier | text | starter, pro, agency |
| settings | jsonb | Return en business parameters (regels etc.) |
*Relaties: has_many orders, has_many conversations, has_many customers.*

### customers
| Kolom | Type | Beschrijving |
|---|---|---|
| id | uuid (PK) | Interne identifier |
| merchant_id | uuid (FK) | Scope |
| email | varchar | Klant email adres |
| shopify_customer_id | varchar | ID afkomstig van sync |

### conversations
| Kolom | Type | Beschrijving |
|---|---|---|
| id | uuid (PK) | Interne ticket ID |
| merchant_id | uuid (FK) | Scope |
| customer_id | uuid (FK)| Betreffende klant |
| channel | text | 'email' |
| status | text | 'open', 'resolved', 'escalated' |
*Relaties: has_many messages*

### messages
| Kolom | Type | Beschrijving |
|---|---|---|
| id | uuid (PK) | Uniek ID |
| conversation_id | uuid (FK) | De thread |
| sender_type | text | 'customer', 'merchant', 'ai' |
| body_text | text | De parsed inhoud |
| raw_payload | jsonb | Originele AWS of Webhook block |
| intent | text | AI classification (bijv. 'refund_request') |

### orders
| Kolom | Type | Beschrijving |
|---|---|---|
| id | uuid (PK) | Interne ID |
| merchant_id | uuid (FK) | Scope |
| shopify_order_id | varchar | De raw identifier van Shopify |
| tracking_number | varchar | Extracted van Shopify fulfillments |
| fulfillment_status | varchar | 'fulfilled' etc. |
| total_price | decimal | Valuta bedrag |
*Relaties: has_many negotiations*

### negotiations
| Kolom | Type | Beschrijving |
|---|---|---|
| id | uuid (PK) | Onderhandeling structuur |
| order_id | uuid (FK) | De bestelling ter discussie |
| conversation_id | uuid (FK) | De bijbehorende email thread |
| status | varchar | 'initiated', 'offer_sent', 'offer_rejected', 'completed' |
| current_step | int | (1,2,3) conform settings cascade |
*Aangestuurd via RPC atomic mutaties in supabase.*

### refund_logs
| Kolom | Type | Beschrijving |
|---|---|---|
| id | uuid (PK) | - |
| negotiation_id | uuid (FK) | Waar de log is uitgespuugd |
| amount | decimal | Bedrag daadwerkelijk uitbetaald op shopify |

### knowledge_base
| Kolom | Type | Beschrijving |
|---|---|---|
| id | uuid (PK) | Document structuur |
| merchant_id | uuid (FK) | Scope |
| content | text | De antwoorden en huisregels (voor AI retrieval) |


## Authenticatie Flow
Shopify App Bridge wordt niet gebruikt voor authentication omdat dit platform cross-channel functioneert. In plaats daarvan sturen we de OAuth flow aan via:
`App hit` → `/api/shopify/install` → `Shopify Machtiging` → `Callback handler (/api/shopify/callback)` → Controleert HMAC → Vraagt permanent access token aan (en slaat dit encrypted op i.v.m GDPR) → Roept intern Supabase `signInWithOtp` (Magic Link) aan om een onzichtbare sessie-cookie aan te maken via de background → Vercel serveert de redirect met een valide session cookie waardoor de client de rest van het platform veilig als standalone admin kan verkennen.

## SES Email Pipeline (inbound)
Wanneer een mail bij Amazon in de bucket valt, stuurt Amazon SNS een json trigger:
Stappen binnen `webhook-service.ts`:
1. Parse raw email (Extract sender/body).
2. Lookup Merchant (Via domain-matching of unieke receiving alias).
3. Lookup Customer (Creeërt record in DB of update metadata).
4. Lookup Conversation (Bestaande thread vs nieuwe email thread).
5. OpenAI Classificatie (GPT-4o evalueert sentiment en intent: Returns vs Standard vs Spam).
6. State Machine injection (Start returns negotiation flow of wacht op handmatige merchant override).

## Shopify Webhook Pipeline
Shopify stuurt fulfillment en order updates → Endpoit valideert secret via `X-Shopify-Hmac-Sha256` hashing → Switch case stuurt payload door via `WebhookService` → `OrderService` upsert order, destilleert tracking links en marks fulfillment state af in Dashboard view inclusief metrics trigger.

## Return Negotiation State Machine
```text
[initiated] ──(Offer Rule 1)──→ [offer_sent]
                                     │
            ┌────────────────────────┼───────────────┐
            │                        │               │
      (Klant dalt af)          (Klant negeert)   (Klant gaat akkoord)
            │                        │               │
    [offer_rejected]             [expired]       [completed] ──→ Refund op API level
            │                        
   (Offer Rule 2 trigger)  
            │
      [offer_sent] etc...
```

## Key Design Decisions
- **Standalone app**: Het platform draait native op Vercel (eigen tab) en is niet vastgeketend aan Shopify Admin view door third-party iframe cookie strictures.
- **gpt-4o-mini**: Kosten per intent-classification tot bodemniveau gemanteld terwijl complex begrip op de Nederlandse returns perfect intact blijft ten opzichte van gpt-3.5.
- **AES-256-CBC**: Shopify REST API keys worden blind in supabase geforceerd om data breach risico absoluut zero te houden, cryptografisch omkranst per Vercel runtime.
- **Email-first**: De engine is losgekoppeld geschreven met de "Kanaal (Channel)" kolom, later inplugtbaar met Twilio WhatsApp nummers.
- **RPC Mutations**: Race conditions worden bij returns geneutraliseerd doordat een stored procedure direct Postgres lockt voor steps updates (`010_negotiation_offer_rpc`).
