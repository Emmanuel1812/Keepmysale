# Plan: fix the embedded login, then make it safe for a pilot merchant

Written 18 Oct 2026 after testing the live app inside Shopify admin
(efo-testing-store) and reading the code. Order matters: step 0 first.

## What was observed

- The app opens inside Shopify admin and renders (Dashboard, Returns, Inbox, Settings).
- Every data call then fails with **"Unauthorized - No merchant found for session"**;
  Settings shows Shopify and Gmail "Not connected", brand name empty.
- Cause: `src/lib/auth.ts` identifies the merchant by a Supabase **cookie**. Inside the
  Shopify iframe that cookie is a third-party cookie and Chrome blocks it. The code has a
  fallback (`X-Shop-Domain` header), but only 3 of the 53 call sites pass it
  (`api/orders`, `api/analytics/summary`, `api/shopify/sync-orders`), and the header is
  unauthenticated: **anyone who knows a shop domain can read that shop's data.**
- Each load re-runs the whole OAuth callback (about 6 s) and re-registers 5 webhooks;
  Shopify answers 422 "already taken" (REST error rate 83% in the Dev Dashboard). Noise,
  not the failure, but it should stop.
- Typing `https://shop.myshopify.com/` in the connect field produced
  `https://https//shop.myshopify.com//admin/oauth/authorize...` and "site can't be reached".
  **Fixed on branch `fix/shop-domain-validation`** (13 tests).
- `state` is generated at install but never stored or checked in the callback.

## Step 0 - today, before any code: rotate everything that was public

A public branch (`main`, tip e25a37d, April 2026) contained live credentials.

1. Shopify: for each store used in the old Python scripts (alma-de-lisboa.com,
   verlaine-avenue.com, qfqvbf-0c.myshopify.com), uninstall/revoke the custom app and
   generate a new Admin API token. Rotate the keepmysale app client secret in the Dev Dashboard.
2. Google: delete and recreate the OAuth client (the `client_secret_...json`), revoke the
   Gmail refresh token (myaccount.google.com/permissions), re-consent.
3. Gemini and Groq: delete and recreate the API keys.
4. Supabase (project urjupbzufzppfvclrjst): rotate the service-role key and the JWT secret
   if it was ever in a committed file. Put the new values only in Vercel env vars.
5. Locally: delete the local branches `main`, `clean-main`,
   `backup/pre-secret-cleanup-20260408`; never push them. The repo is public: make it
   private (GitHub > Settings) until this is done.

## Step 1 - Shopify session tokens (replaces cookie auth inside the iframe)

Standard Shopify pattern, no third-party cookies needed.

1. `src/app/layout.tsx`: add `<meta name="shopify-api-key" content={SHOPIFY_API_KEY}>` and
   the App Bridge script `https://cdn.shopify.com/shopifycloud/app-bridge.js` (must be the
   first script, loaded from Shopify's CDN).
2. New `src/lib/shopify/session-token.ts`: verify the JWT from `Authorization: Bearer`:
   HS256 with `SHOPIFY_API_SECRET`; check `exp`/`nbf`; `aud === SHOPIFY_API_KEY`;
   `iss` host equals `dest` host; take the shop from `dest` (`https://<shop>`), validate
   with `isValidShopDomain`. Use `jose` (small, maintained).
3. `src/lib/auth.ts`: `getMerchantFromSession(request)` order:
   (a) valid Bearer session token -> `findByShopDomain(shop)`;
   (b) Supabase cookie -> `findByUserId` (this keeps keepmysale.com working standalone);
   (c) nothing else. **Delete the `X-Shop-Domain` fallback.**
4. Client: one `apiFetch()` wrapper that, when embedded, calls `await shopify.idToken()`
   and sets `Authorization: Bearer ...` (App Bridge refreshes it; tokens live 60 s). Replace
   the raw `fetch` calls in `dashboard/page.tsx`, inbox, returns, settings, orders.
5. All 26 route files that call `getMerchantFromSession` get the `request` passed in.
6. Token exchange (optional, recommended): with embedded session tokens Shopify can issue
   the offline access token via OAuth **token exchange**, so the full redirect OAuth
   (and the 6 s load and webhook re-registration) only happens on first install.
7. Webhooks: stop registering them in the OAuth callback. Declare them in the Dev
   Dashboard app configuration (orders/create, orders/updated, fulfillments/create,
   fulfillments/update, app/uninstalled) so Shopify owns them.

Acceptance (embedded, efo-testing-store, Chrome with third-party cookies blocked):
Dashboard shows numbers, "Sync Orders" imports the test store's orders, Settings shows
Shopify "Connected", reload takes under 2 s, and
`curl -H "X-Shop-Domain: efo-testing-store.myshopify.com" https://<host>/api/orders` returns 401.

## Step 2 - callback hardening (before anyone but you installs it)

- Store `state` in a signed, short-lived cookie at `/api/shopify/install`; compare in
  `/api/shopify/callback`; reject on mismatch.
- Constant-time HMAC compare (`crypto.timingSafeEqual`).
- `callback` validates `shop` with `isValidShopDomain`.
- Stop auto-login-by-email in the callback; the session token replaces it.
- `/api/cron/check-gmail`: require `Authorization: Bearer ${CRON_SECRET}` (Vercel sets it),
  not the presence of an `x-vercel-cron` header.
- `/api/billing/subscribe`: require a merchant session; never the service-role client.
- SES inbound webhook: verify the SNS signature.
- Do not run `pnpm test` as-is: `.env.test` points at the live Supabase project and the
  tests write rows. Point it at a separate test project first.

## Step 3 - what a pilot merchant needs (1 to 3 shops, free, drafts-only)

1. Privacy policy and terms pages (link target `/privacy` does not exist today), and
   remove "Join 50+ Shopify merchants" from the landing page.
2. Shopify mandatory compliance webhooks: `customers/data_request`, `customers/redact`,
   `shop/redact` (a route that answers 200 and does the deletion in Supabase).
3. AI: paid Gemini tier (free tier allows about 20 requests a day) or keep Groq fallback.
4. Cron: Gmail polling is once a day on Vercel Hobby. Either Vercel Pro, or move
   `saas-platform/.github/workflows/cron-pinger.yml` to the repo root `.github/workflows/`.
5. Return offers: keep refund one click away; the offer ladder is an optional sweetener,
   never a precondition (EU withdrawal button, in force since 19 Jun 2026). Partial refunds
   by default only for damaged/defective items.
6. Gmail: Google treats `gmail.modify` / `gmail.send` as restricted scopes. For a pilot,
   stay in "Testing" mode (100 users) or default to SES forwarding.
7. Dev Dashboard distribution is a custom install link. For strangers keep sharing that
   link; a public App Store listing additionally needs Shopify billing instead of Mollie,
   GraphQL instead of REST, and the review (2 to 6+ weeks).

## Environments

- `keepmysale.com` (Cloudflare DNS -> Vercel) answers 200 on both its IPs. The Vercel
  git-preview URL sits behind Vercel SSO login, so outsiders get a login wall.
- Preview deployments use `SHOPIFY_APP_URL=https://keepmysale.com`, so Shopify redirects
  back to production after OAuth. Test OAuth on the production domain, or give previews
  their own `SHOPIFY_APP_URL` and add that redirect URL to the app in the Dev Dashboard.
