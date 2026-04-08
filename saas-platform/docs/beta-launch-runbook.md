# Beta Launch Runbook (Phase 3)

## Alpha Merchant Preparation
1. Select 3-5 pilot stores with varied ticket volume.
2. Onboard each merchant through Shopify OAuth install flow.
3. Verify SES domain identity and inbound rule set for each merchant support address.

## App Store Distribution (Thin App)
1. Create Shopify app listing assets and privacy policy pages.
2. Submit thin installer app:
   - Install permissions
   - OAuth callback
   - Redirect to standalone onboarding
3. Maintain release notes and support contact process.

## Billing with Mollie
1. Create plans (Starter/Growth/Pro) in product config.
2. Enable trial period and failed payment retry policy.
3. Track subscription status and enforce plan limits in API layer.

## Reliability Gate
- Webhook delivery retries enabled
- Dead-letter queue strategy documented
- Alerting configured for failed automations and API errors
- Audit event log reviewed daily during beta
