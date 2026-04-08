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
| bird_channel_id | text | MessageBird channel ID |
| whatsapp_phone_number | text | Gekoppeld WhatsApp nummer |
| ses_verified_domain | text | Amazon SES custom return domain |
| mollie_customer_id | text | Betaal identificatie |
| subscription_tier | text | trial, starter, growth, scale |
| subscription_status | text | trial, active, past_due, cancelled |
| trial_ends_at | timestamptz | Einde proefperiode |
| onboarding_completed | boolean | Setup voltooid flag |
| settings | jsonb | Return en business parameters (regels etc.) |
| created_at / updated_at | timestamptz | Audit timestamps |
*Relaties: has_many orders, has_many conversations, has_many customers.*

### customers
| Kolom | Type | Beschrijving |
|---|---|---|
| id | uuid (PK) | Interne identifier |
| merchant_id | uuid (FK) | Scope |
| email | text | Klant email adres |
| phone | text | Klant telefoonnummer |
| name | text | Naam van de klant |
| shopify_customer_id | text | ID afkomstig van sync |
| language | text | Taalvoorkeur ('nl', 'en') |
| metadata | jsonb | Extra Shopify variabelen |
| created_at / updated_at | timestamptz | Audit timestamps |

### conversations
| Kolom | Type | Beschrijving |
|---|---|---|
| id | uuid (PK) | Interne ticket ID |
| merchant_id | uuid (FK) | Scope |
| customer_id | uuid (FK)| Betreffende klant |
| channel | text | 'email' of 'whatsapp' |
| status | text | 'open', 'resolved', 'escalated' |
| subject | text | E-mail onderwerp |
| intent | text | Huidige AI klassificering scope |
| assigned_to | uuid (FK) | Admin user toewijzing |
| ai_resolved | boolean | Was dit volledig AI gestuurd |
| shopify_order_id | text | Gekoppelde order string |
| last_message_at | timestamptz | Handig voor SLA sortering |
| resolved_at | timestamptz | Moment van sluiting |
| metadata | jsonb | Inbound context data |
| created_at / updated_at | timestamptz | Audit timestamps |
*Relaties: has_many messages*

### messages
| Kolom | Type | Beschrijving |
|---|---|---|
| id | uuid (PK) | Uniek ID |
| conversation_id | uuid (FK) | De thread |
| merchant_id | uuid (FK) | Scope bypass |
| sender | text | 'customer', 'merchant', 'ai', 'system' |
| channel | text | Communicatie bron |
| content | text | De parsed inhoud |
| content_html | text | Raw email design view |
| external_message_id | text | SES of WhatsApp Message-ID tracking |
| attachments | jsonb | Array met URLs/references |
| ai_confidence | float | Zekerheidsscore van gpt-4o |
| metadata | jsonb | Overige header meta |
| created_at | timestamptz | Timestamp binnen thread |

### orders
| Kolom | Type | Beschrijving |
|---|---|---|
| id | uuid (PK) | Interne ID |
| merchant_id | uuid (FK) | Scope |
| shopify_order_id | text | De raw identifier van Shopify |
| shopify_order_number | text | Visuele '#1000' nummers |
| customer_id | uuid (FK) | Koper identifier |
| email | text | Fallback copy van snapshot |
| financial_status | text | 'paid', 'refunded' etc. |
| fulfillment_status | text | 'fulfilled', 'unfulfilled' etc. |
| total_price | decimal | Valuta bedrag |
| currency | text | Betalingsvaluta (default 'EUR') |
| line_items | jsonb | Array van gekochte varianten |
| tracking_number | text | Extracted van Shopify fulfillments |
| tracking_url | text | Extracted courier link |
| tracking_company | text | Extracted (PostNL, DHL) |
| delivered_at | timestamptz | Voltooiingstijd courier webhook |
| proactive_check_sent | boolean | Voorkoming van spam double triggers |
| synced_at | timestamptz | Laatste Shopify webhook sync |
| created_at / updated_at | timestamptz | Audit timestamps |
*Relaties: has_many negotiations*

### negotiations
| Kolom | Type | Beschrijving |
|---|---|---|
| id | uuid (PK) | Onderhandeling structuur |
| merchant_id | uuid (FK) | Scope |
| conversation_id | uuid (FK) | De bijbehorende email thread |
| customer_id | uuid (FK) | Koper |
| order_id | uuid (FK) | De bestelling ter discussie |
| status | text | 'initiated', 'offer_sent', 'offer_rejected', 'completed', 'expired', 'return_initiated' |
| current_step | int | State pointer (1,2,3) |
| max_steps | int | Dynamische threshold limit |
| offers | jsonb | Track record van aangeboden percentages |
| product_cost | decimal | Kostprijs validatie |
| estimated_return_cost | decimal | Algoritme berekening logistiek |
| final_refund_amount | decimal | Daadwerkelijk geaccepteerde discount |
| final_refund_type | text | partial_refund, store_credit, exchange |
| shopify_refund_id | text | Gekoppeld aan Shopify REST api object |
| return_reason | text | NLP extracted reden |
| customer_feedback | text | Wat klant antwoordde op deal |
| savings | decimal | Berekende marge bespaard |
| audit_pdf_url | text | Archivering storage link |
| completed_at | timestamptz | Deal sluiting of fallback sturing |
| created_at | timestamptz | Start van flow |
*Aangestuurd via RPC atomic mutaties in supabase.*

### refund_logs
| Kolom | Type | Beschrijving |
|---|---|---|
| id | uuid (PK) | Audit log |
| merchant_id | uuid (FK) | Scope |
| negotiation_id | uuid (FK) | Waar de log is uitgespuugd |
| order_id | uuid (FK) | Gekoppelde sale |
| customer_id | uuid (FK) | Persoon die ontving |
| action | text | Bijv. 'refund_executed' |
| amount | decimal | Bedrag daadwerkelijk uitbetaald op shopify |
| currency | text | Rekeneenheid |
| shopify_refund_id | text | REST referentie |
| shopify_transaction_id | text | Stripe/Mollie reference |
| channel | text | Langs waar geinitieerd |
| customer_consent_recorded | boolean | Juridische flag opt-in |
| audit_details | jsonb | Raw JSON trace calls |
| created_at | timestamptz | Tijdlijn index |

### knowledge_base
| Kolom | Type | Beschrijving |
|---|---|---|
| id | uuid (PK) | Document structuur |
| merchant_id | uuid (FK) | Scope |
| title | text | Naam of trefwoord snippet |
| content | text | De antwoorden en huisregels |
| content_embedding | vector(1536)| Pinecone/Postgis OpenAI Vector ruimte |
| category | text | Type ruleset |
| language | text | Locale detectie |
| active | boolean | In of out gescopeed uit memory |
| created_at / updated_at | timestamptz | Audit timestamps |


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
