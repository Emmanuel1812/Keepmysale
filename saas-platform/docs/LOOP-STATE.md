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
1. ~~Email polling every 5 min~~ DONE in code (root `.github/workflows/keepmysale-gmail-poll.yml`, skips itself until GitHub secret CRON_SECRET exists). Also fixed a hole: `x-vercel-cron` header was trusted and an unset CRON_SECRET matched "Bearer undefined".
1b. Root `.github/workflows/email-automation.yml` runs the OLD Python Kingston/Alma script daily; check whether it still sends mail and whether it should be disabled (read the file, do not run it).
2. Audit: did the AI send replies to Shopify/Microsoft junk mail through Gmail? Read-only SQL on messages/conversations (sender=ai, category non-support), report counts.
3. Shopify install callback: verify `state` cookie, token exchange path, and tests.
4. Move other webhooks (app/uninstalled etc.) to config-based subscriptions if still code-registered; keep behaviour.
5. Re-run default test suite + type check + lint; fix whatever is red.
6. Dashboard/inbox polish found while testing in the browser at keepmysale.com (read-only, no sends).
7. Unexplained revenue €3086.42 vs $3095.13; pre-existing failing e2e TEST 2 (investigate read-only).

## Needs Emmanuel
- Rotate leaked credentials (Shopify tokens of 3 old stores, Google OAuth client + Gmail token, Gemini/Groq keys, Supabase keys); make the GitHub repo private.
- CRON_SECRET (>= 16 chars, random) must exist in Vercel Production env, and the same value as GitHub repo secret `CRON_SECRET`. Until it is set in Vercel, the cron routes answer 401 (Vercel then also sends it automatically on its daily cron). I could not read Vercel envs (MCP lacks team access).
- Confirm company-name spelling "EFO Commerces".
- Gmail restricted-scope verification (Google) or SES forwarding before real pilot merchants.

## Log
- 20 Oct (loop 1): cron auth fixed (new src/lib/cron-auth.ts, 4 tests, mutation-checked; default suite 89 pass, tsc clean), 5-min poll workflow moved to repo root.
- 20 Oct: compliance webhooks registered and released (version compliance-webhooks, Active); endpoint 401 unsigned.
