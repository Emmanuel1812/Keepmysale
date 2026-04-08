# API Documentation

## Auth & Shopify Endpoints

### GET /api/shopify/install
**Auth:** None
**Beschrijving:** Initieert de Shopify OAuth sessie. Redirect de merchant naar het bewuste Shopify permssie-scherm afhankelijk van het `shop` query param.
**Request Params:**
- `shop` (string)

### GET /api/shopify/callback
**Auth:** None (Shopify HMAC)
**Beschrijving:** Ontvangt de tijdelijke code van Shopify, verifieert HMAC, vraagt de access token op, creëert of update de `merchants` row, en initieert een Supabase OTP Magic Link flow voor Cookie creatie in de achtergrond.
**Request Params:**
- `code`, `shop`, `hmac`, `host`

### POST /api/shopify/sync-orders
**Auth:** Supabase Session
**Beschrijving:** Triggert een asynchrone pull van recente orders (status=any) via de Shopify REST API en slaat ze op of update ze in de lokale `orders` tabel. Handelt de Protected Customer scope error af met reconnect links.
**Response:**
```json
{ "success": true, "data": { "synced": number } }
```

## Dashboard & App Routes

### GET /api/health
**Auth:** None
**Beschrijving:** Interne health checker.
**Response:**
```json
{ "success": true, "data": { "status": "ok", "timestamp": "ISO-STRING" } }
```

### POST /api/merchant/onboarding
**Auth:** Supabase Session
**Beschrijving:** Configureert initial instellingen na registratie.
**Request body:**
```json
{
  "merchantName": "string",
  "shopDomain": "string",
  "supportEmail": "email",
  "step1Percentage": 20,
  "step2Percentage": 35,
  "step3Percentage": 50
}
```
**Response:**
```json
{ "success": true, "data": { "merchantId": "uuid" } }
```

### GET /api/merchant/settings
**Auth:** Supabase Session
**Beschrijving:** Haalt de huidige settings en basis-info op voor weergave in het instellingen formulier.
**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "shopName": "string",
    "email": "string",
    "settings": { "return_negotiation_enabled": true, "negotiation_offers": [...] }
  }
}
```

### PATCH /api/merchant/settings
**Auth:** Supabase Session
**Beschrijving:** Overschrijft geselecteerde settings binnen het settings JSONB object.
**Request body:**
```json
{
  "shopName": "string",
  "email": "string",
  "settings": { ... partial overrides ... }
}
```

### GET /api/orders
**Auth:** Supabase Session
**Beschrijving:** Haalt alle lokale orders op van de betreffende merchant.
**Response:**
```json
{
  "success": true,
  "data": {
    "orders": [
      {
         "id": "uuid",
         "shopifyOrderNumber": "string",
         "financialStatus": "paid",
         "fulfillmentStatus": "fulfilled",
         "trackingNumber": "string",
         "totalPrice": "100.00",
         "currency": "EUR"
      }
    ]
  }
}
```

### GET /api/inbox/conversations
**Auth:** Supabase Session
**Beschrijving:** Haalt gegroepeerde mail conversations op per merchant.

### GET /api/inbox/conversations/[id]/messages
**Auth:** Supabase Session
**Beschrijving:** Laat alle in- en outbound messages zien van een unieke conversation, eigendom geverifieerd.

### POST /api/inbox/conversations/[id]/reply
**Auth:** Supabase Session
**Beschrijving:** Verstuurt direct een message naar de klant via Amazon SES en documenteert deze in de database.

### GET /api/analytics/summary
**Auth:** Supabase Session
**Beschrijving:** Berekening API voor de metrics dashboard cards via DAL aggregation.
**Response:**
```json
{
  "success": true,
  "data": {
    "openConversations": 1,
    "resolvedToday": 0,
    "activeNegotiations": 0,
    "returnsPrevented": 0,
    "totalOrders": 10,
    "totalRevenue": 2500.00,
    "avgOrderValue": 250.00,
    "fulfilledOrders": 4,
    "shopName": "My Store"
  }
}
```

### POST /api/billing/subscribe
**Auth:** Supabase Session
**Beschrijving:** Creëert Mollie payment subscription link voor tier upgrade.

## Webhooks (Inbound Services)

### POST /api/webhooks/ses
**Auth:** Geen (AWS SNS Signature check intern)
**Beschrijving:** Ontvangt inbound gestructureerde notificatys (JSON) van Amazon Simple Email Service (SES) via Amazon SNS inclusief de raw email content verstuurd naar merchants. Trigger voor de AI engine en State machine.

### POST /api/webhooks/shopify
**Auth:** Shopify HMAC secret (`X-Shopify-Hmac-Sha256`)
**Beschrijving:** Handler voor real-time shopify triggers zoals `orders/create` en `fulfillments/update`.
