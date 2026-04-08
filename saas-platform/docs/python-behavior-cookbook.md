# Python Behavior Cookbook (Reference Only)

Source references:
- `../alma_de_lisboa_email_assistant_final.py`
- `../resend_confirmation/resend_confirmation_addon.py`

## Intent and Routing Rules
- `likely_resend_request(...)` drives resend-confirmation intent with multilingual patterns.
- `wants_resend_confirmation(...)` in addon confirms resend intent.
- WISMO/tracking behaviors rely on order lookup by email or explicit order number.
- Return flows include stepped negotiation and rejection counting.

## Core Behaviors to Preserve
1. Detect resend confirmation intent before generic AI response.
2. For resend requests, attempt order lookup and send confirmation immediately.
3. For WISMO requests, prioritize tracking extraction and concise status reply.
4. For return requests, offer negotiation path before full return handoff.
5. On low-confidence or missing order data, escalate to human review.

## Golden Scenarios
1. Customer asks to resend confirmation in Dutch.
2. Customer asks where order is with order number present.
3. Customer asks for return because product is damaged.
4. Customer sends generic support request with no order context.
5. Customer asks where order is but order cannot be found.
