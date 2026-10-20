# Autonomous improvement loop: state

Started 20 Oct 2026 on Emmanuel's instruction ("blijf loopen, verbeter dingen en maak alles klaar zonder dat ik een prompt hoef te geven").
Each wakeup: read this file, do ONE backlog item end to end, update this file, schedule the next wakeup (60-120 s).

## Rules (do not bend)
- Work on branch `feat/privacy-and-compliance` or a new feature branch; merge to prod by fast-forwarding `saas-platform-clean` only when `vitest` (default run, never `KMS_LIVE_TESTS`) and `tsc`/build are green. Check Vercel status after a push.
- Never: enter passwords/keys, rotate or create credentials, send real emails to customers, spend money, run destructive SQL, run live-DB tests, change prices, accept terms/OAuth grants.
- Supabase MCP: read-only SQL only.
- Anything that needs Emmanuel (secrets, accounts, decisions) goes under "Needs Emmanuel" with the exact step, and the loop moves on.
- Every fix gets a test that fails without it (mutation-check). No claim of "done" without running it.
- Stop the loop (ScheduleWakeup stop) when the backlog is empty or only "Needs Emmanuel" remains; then report in Dutch.

## Backlog (top first)
0. Every wakeup first: check the Vercel status of `git rev-parse origin/saas-platform-clean` (GitHub commit status API). If it is failure/error, fix or roll back before anything else. (Loop 4 commit was still "pending" when last checked.)
1. ~~Email polling every 5 min~~ DONE in code (root `.github/workflows/keepmysale-gmail-poll.yml`, skips itself until GitHub secret CRON_SECRET exists). Also fixed a hole: `x-vercel-cron` header was trusted and an unset CRON_SECRET matched "Bearer undefined".
1b. ~~old Python workflow~~ CHECKED: GitHub has it `disabled_inactivity` (last run 22 Jun), no credentials.json tracked, so it cannot send. Harmless; leave.
2. ~~Audit junk-mail replies~~ DONE (read-only SQL): 8 AI-sender rows in total. 7 are `is_fallback_draft` drafts (saved when the `ai_draft` enum value was still missing; the code returns "draft_saved" before sending), none ever sent: 4 of them on non-support mail ("Welcome to Brand agents family!" x2, "Order #1687 confirmed", one blank subject). 1 genuine reply to a known customer (return #1004, 11 Jun). Spam/financial/unknown rows have zero AI messages. Enum now has `ai_draft`. No junk mail was answered.
2b. ~~ai_scheduled~~ CHECKED, no change needed: the fallback stores `original_sender: "ai_scheduled"` plus `is_scheduled`, and every reader (edit, send-now, thread UI, cron send) checks `isScheduled` or `original_sender`. Original note: `ai_scheduled` (used as senderLabel in webhook-service when a reply is delayed/outside business hours) is NOT in the `message_sender` enum (values: customer, ai, human_agent, system, ai_draft). Scheduled replies therefore fall into the catch-block fallback and are saved as sender `ai` with `is_fallback_draft:true`. Check how scheduled sends are picked up and whether this mislabels or double-handles them; fix with a test (migration = production change, so prefer a code-side fix or ask).
3. ~~Shopify install callback~~ DONE: `state` was generated but never checked (login CSRF). Install now sets an httpOnly state cookie (path /api/shopify, 10 min), callback requires it to match, plus fresh timestamp (<=15 min) and a real myshopify host; an install started on another host (preview, www) is redirected to the canonical host first so the cookie survives. 9 tests in `oauth-state.test.ts`, each guard mutation-checked. NOT tested end to end against a real Shopify install (would uninstall/reinstall the test store): if an install ever fails with "Install session expired", look here first.
4. ~~Other webhooks~~ DONE in code, two real bugs: (a) Admin-API webhooks are signed with the app CLIENT secret but the route only accepted SHOPIFY_WEBHOOK_SECRET (a separate placeholder-style env var), so real orders/fulfillment deliveries would 401 unless prod had copied the client secret into it; now either secret is accepted. (b) `app/uninstalled` was registered but ignored; now it clears the revoked Shopify token. 6 tests in `shopify-webhook-auth.test.ts`, mutation-checked. Still code-registered via `registerWebhooks` (config-based subscriptions deliberately NOT changed: would need another CLI deploy and risks duplicate deliveries). Unverified: whether prod orders are arriving by webhook (check `orders` created_at vs Shopify) or only via sync.
5. ~~Suite/typecheck/lint~~ DONE: suite + tsc green. Lint = 101 errors (85 no-explicit-any, 48 unused vars, a few cosmetic), all legacy style debt, none block `next build`; deliberately NOT mass-fixed (churn on live code for no behaviour gain).
6. Dashboard/inbox polish in the browser (keepmysale.com, read-only). Done on /dashboard: stat cards showed "€0.00 / 0 orders" for ~8 s while the orders table below was already full (looked broken, wrong currency); now a pulse placeholder until the summary arrives. "##1001" fixed to "#1001" (`lib/order-label.ts`). `/api/analytics/summary` took ~3.1 s: four table reads ran one after another and the messages read downloaded every body + HTML. Now parallel (Promise.all) and a slim `MessagesDal.findTimelineByMerchant` (conversation_id, sender, created_at); 3 tests in `analytics-queries.test.ts`, both guards mutation-checked. Re-measure on the live site. STILL TO DO: other callers that fetch full messages for whole mailboxes (inbox conversations route, sidebar badge: grep `messagesDal.findByMerchant`), then walk Inbox, Orders, Returns, Settings in the browser.
7. ~~Revenue mismatch~~ EXPLAINED: DB has 5 USD orders = $3095.13, no refunds; the old €3086.42 cannot be reproduced (earlier snapshot). Pre-existing failing e2e TEST 2 is a live-DB test, excluded by default; leave.

## Needs Emmanuel
- Rotate leaked credentials (Shopify tokens of 3 old stores, Google OAuth client + Gmail token, Gemini/Groq keys, Supabase keys); make the GitHub repo private.
- CRON_SECRET (>= 16 chars, random) must exist in Vercel Production env, and the same value as GitHub repo secret `CRON_SECRET`. Until it is set in Vercel, the cron routes answer 401 (Vercel then also sends it automatically on its daily cron). I could not read Vercel envs (MCP lacks team access).
- Confirm company-name spelling "EFO Commerces".
- Gmail restricted-scope verification (Google) or SES forwarding before real pilot merchants.

## Log
- 20 Oct (loop 1): cron auth fixed (new src/lib/cron-auth.ts, 4 tests, mutation-checked; default suite 89 pass, tsc clean), 5-min poll workflow moved to repo root.
- 20 Oct (loop 6): analytics summary reads parallel + slim messages (suite 110 pass, tsc clean).
- 20 Oct (loop 5): loop-4 deploy verified success; dashboard loading placeholder + "##" fix (suite 107 pass, tsc clean).
- 20 Oct (loop 4): webhook signature accepts the app client secret; app/uninstalled clears the token (suite 104 pass, tsc clean).
- 20 Oct (loop 3): OAuth state/timestamp/host checks in the install callback (default suite 98 pass, tsc clean).
- 20 Oct (loop 2): audits 1b and 2 done read-only (see backlog); nothing was sent to junk mail; no code change.
- 20 Oct: compliance webhooks registered and released (version compliance-webhooks, Active); endpoint 401 unsigned.
