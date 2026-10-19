# Privacy compliance: Shopify's mandatory webhooks

Shopify requires every app to answer three privacy topics. They are implemented at one endpoint:

    POST https://keepmysale.com/api/webhooks/shopify/compliance

Code: `src/app/api/webhooks/shopify/compliance/route.ts`, `src/services/compliance-service.ts`.
Tests: `src/tests/compliance.test.ts` (signature, topics, which rows are erased and which are not).

| Topic | When Shopify sends it | What we do |
|---|---|---|
| `customers/redact` | a merchant's customer asked to be erased | delete the customer row (conversations, messages and negotiations cascade); replace the email on their orders with `<order id>@redacted.invalid` (matched by email and by `orders_to_redact`); other shops are never touched |
| `shop/redact` | 48 h after the app is uninstalled | delete the merchant row (everything about the shop cascades) and the owner's Supabase login |
| `customers/data_request` | a customer asked what we hold | acknowledged and logged; **no automated export yet**, see below |

Answers: `401` for a bad signature (signed with the app **client secret**, `SHOPIFY_API_SECRET`), `400` for an
unknown topic or malformed shop, `200` when handled, `500` when it failed so Shopify retries. Logs contain the
topic, shop and counts, never customer data.

## Registering the endpoint (one-time, in the Dev Dashboard)

The endpoint does nothing until Shopify is told about it.

1. dev.shopify.com > Apps > keepmysale > Versions > New version.
2. Under **Webhooks / Compliance webhooks**, set all three URLs (customer data request, customer data erasure,
   shop data erasure) to the endpoint above. Use the app's own domain `https://keepmysale.com`.
3. Release the version. Then use the Dev Dashboard's webhook test/"send test notification" for each topic and
   check the response is 200 (and 401 for a wrong signature).

## Answering a data request by hand

Until there is an export button: when a `customers/data_request` arrives (visible in the Vercel logs as
`[compliance] {"topic":"customers/data_request",...}`), find the customer by email in the `customers`,
`conversations`, `messages`, `orders` and `negotiations` tables for that shop, and send the merchant a copy within
30 days. The merchant is the controller and passes it to the customer.

## What is kept after an erasure

Refund log rows keep their amounts and Shopify refund ids (financial records), with the customer link removed.
Order rows keep totals, items and tracking, without an email.
