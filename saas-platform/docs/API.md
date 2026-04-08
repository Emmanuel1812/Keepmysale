# API Reference

All API routes return JSON via:
- success: `{ "success": true, "data": ... }`
- error: `{ "success": false, "error": { "code", "message", "details?" } }`

## GET `/api/health`
- **Auth**: No
- **Request body**: None
- **Response**:
  - `200` -> `{ status, service, now }`
- **Example response**
```json
{
  "success": true,
  "data": {
    "status": "ok",
    "service": "returnshield-saas-platform",
    "now": "2026-04-08T18:00:00.000Z"
  }
}
```
- **Errors**: none in current implementation

## POST `/api/merchant/onboarding`
- **Auth**: Yes (session required via `getMerchantFromSession`)
- **Request body (Zod)**:
  - `merchantName: string(min 2)`
  - `shopDomain: string(min 3)`
  - `supportEmail: email`
  - `step1Percentage: int 0..100`
  - `step2Percentage: int 0..100`
  - `step3Percentage: int 0..100`
- **Response**:
  - `200` -> `{ merchantId }`
- **Example request**
```json
{
  "merchantName": "Efo",
  "shopDomain": "efo-testing-store.myshopify.com",
  "supportEmail": "support@example.com",
  "step1Percentage": 20,
  "step2Percentage": 35,
  "step3Percentage": 50
}
```
- **Example response**
```json
{
  "success": true,
  "data": { "merchantId": "d04743cc-9fba-402c-a910-04628fe6043f" }
}
```
- **Errors**:
  - `401 UNAUTHORIZED`
  - `400 VALIDATION_ERROR`
  - `404 NOT_FOUND`
  - `500 DB_ERROR`

## GET `/api/inbox/conversations`
- **Auth**: Yes
- **Request body**: None
- **Response**:
  - `200` -> `{ conversations: IConversation[] }`
- **Example response**
```json
{
  "success": true,
  "data": {
    "conversations": []
  }
}
```
- **Errors**:
  - `401 UNAUTHORIZED`

## GET `/api/inbox/conversations/[id]/messages`
- **Auth**: Yes
- **Request**:
  - path param `id: string(min 1)`
  - ownership enforced (`404` on not-owned resources)
- **Response**:
  - `200` -> `{ messages: IMessage[] }`
- **Example response**
```json
{
  "success": true,
  "data": {
    "messages": []
  }
}
```
- **Errors**:
  - `401 UNAUTHORIZED`
  - `400 VALIDATION_ERROR`
  - `404 NOT_FOUND`

## POST `/api/inbox/conversations/[id]/reply`
- **Auth**: Yes
- **Request**:
  - path param `id: string(min 1)`
  - body (Zod): `{ content: string(min 1) }`
  - ownership enforced (`404` on not-owned resources)
- **Response**:
  - `200` -> `{ message: IMessage }`
- **Example request**
```json
{
  "content": "Thanks, we are checking your order."
}
```
- **Example response**
```json
{
  "success": true,
  "data": {
    "message": {
      "id": "msg_123",
      "sender": "human_agent",
      "content": "Thanks, we are checking your order."
    }
  }
}
```
- **Errors**:
  - `401 UNAUTHORIZED`
  - `400 VALIDATION_ERROR`
  - `404 NOT_FOUND`
  - `500 REPLY_ERROR`

## GET `/api/analytics/summary`
- **Auth**: Yes
- **Request body**: None
- **Response**:
  - `200` -> `{ openConversations, resolvedToday, activeNegotiations, returnsPrevented }`
- **Example response**
```json
{
  "success": true,
  "data": {
    "openConversations": 0,
    "resolvedToday": 0,
    "activeNegotiations": 0,
    "returnsPrevented": 0
  }
}
```
- **Errors**:
  - `401 UNAUTHORIZED`

## GET `/api/shopify/install`
- **Auth**: No
- **Request**:
  - query param `shop` required
- **Response**:
  - `200` -> `{ installUrl, state }`
- **Example request**
```
GET /api/shopify/install?shop=efo-testing-store.myshopify.com
```
- **Example response**
```json
{
  "success": true,
  "data": {
    "installUrl": "https://efo-testing-store.myshopify.com/admin/oauth/authorize?...",
    "state": "uuid-state"
  }
}
```
- **Errors**:
  - `400 VALIDATION_ERROR`

## GET `/api/shopify/callback`
- **Auth**: No (creates session)
- **Request**:
  - Shopify OAuth callback params (`shop`, `code`, `hmac`, etc.)
- **Behavior**:
  - validate HMAC
  - exchange code for token
  - fetch shop data
  - encrypt token
  - create/update merchant + Supabase user linkage
  - create session cookie using magiclink + verifyOtp
  - redirect to `/onboarding/configure` or `/dashboard`
- **Response**:
  - HTTP redirect (`307/302` style via `NextResponse.redirect`)
- **Errors**:
  - `400 VALIDATION_ERROR` (missing callback params)
  - `401 UNAUTHORIZED` (OAuth/signature/exchange/auth failures)

## POST `/api/shopify/sync-orders`
- **Auth**: Yes
- **Request body**: None
- **Behavior**:
  - decrypt merchant Shopify token
  - fetch up to 50 orders from Shopify
  - resolve customer by email
  - `upsertFromShopify` per order
- **Response**:
  - `200` -> `{ synced: number }`
- **Example response**
```json
{
  "success": true,
  "data": { "synced": 50 }
}
```
- **Errors**:
  - `401 UNAUTHORIZED`
  - `400 VALIDATION_ERROR` (missing merchant token)
  - `502 UPSTREAM_ERROR` (Shopify request failed)

## POST `/api/webhooks/ses`
- **Auth**: No (payload-validated webhook)
- **Request body (Zod)**:
  - `messageId`, `merchantId`, `from`, `to`, `subject`, `textBody`
- **Response**:
  - `200` -> `{ handled: true, deduplicated, action? }`
- **Example request**
```json
{
  "messageId": "ses-123",
  "merchantId": "d04743cc-9fba-402c-a910-04628fe6043f",
  "from": "customer@example.com",
  "to": "support@example.com",
  "subject": "Where is my order",
  "textBody": "Where is order #1001?"
}
```
- **Example response**
```json
{
  "success": true,
  "data": {
    "handled": true,
    "deduplicated": false,
    "action": "send_tracking_status"
  }
}
```
- **Errors**:
  - `400 VALIDATION_ERROR`
  - `404 NOT_FOUND` (merchant not found)
  - `500 WEBHOOK_PROCESSING_ERROR`

## POST `/api/webhooks/shopify`
- **Auth**: No (HMAC signature required)
- **Request**:
  - raw body
  - headers: `x-shopify-hmac-sha256`, `x-shopify-topic`, `x-shopify-shop-domain`
- **Response**:
  - `200` -> webhook handling result (`{ accepted, topic, orderId? }`)
- **Example response**
```json
{
  "success": true,
  "data": {
    "accepted": true,
    "topic": "orders/create",
    "orderId": "order_123"
  }
}
```
- **Errors**:
  - `401 UNAUTHORIZED` (invalid signature/headers/merchant/topic handling errors)

## POST `/api/billing/subscribe`
- **Auth**: No (current route does not enforce session)
- **Request body (Zod)**:
  - `customerId: string(min 1)`
  - `amountValue: string(min 1)`
  - `description: string(min 2)`
- **Response**:
  - `200` -> `{ subscriptionId, status }`
- **Example request**
```json
{
  "customerId": "cst_123",
  "amountValue": "29.00",
  "description": "Starter plan"
}
```
- **Example response**
```json
{
  "success": true,
  "data": {
    "subscriptionId": "sub_123",
    "status": "pending"
  }
}
```
- **Errors**:
  - `400 VALIDATION_ERROR`
