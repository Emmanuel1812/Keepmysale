# WhatsApp Expansion Plan (Post Email Beta)

## Channel Abstraction Contract
- Keep a channel-agnostic message envelope in domain services:
  - tenant context
  - conversation identifier
  - inbound content
  - outbound action payload

## Bird Integration Steps
1. Add Bird adapter implementing inbound parsing and outbound send methods.
2. Add `/api/webhooks/bird` route with signature verification.
3. Reuse intent classification and negotiation services from email flow.
4. Store WhatsApp messages in the same `conversations` and `messages` tables.

## Inbox and Analytics Changes
- Add channel filter chips in unified inbox UI.
- Add response-time and automation-rate per channel.
- Preserve identical merchant policy controls across channels.

## Rollout Guardrails
- Start with one pilot merchant.
- Feature-flag WhatsApp automation by merchant.
- Enforce human escalation fallback on low confidence.
