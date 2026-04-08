create extension if not exists "pgcrypto";
create extension if not exists "vector";

create table if not exists merchants (
  id uuid primary key default gen_random_uuid(),
  supabase_user_id uuid references auth.users(id) on delete cascade,
  shop_domain text unique not null,
  shop_name text,
  email text not null,
  shopify_access_token_encrypted text,
  bird_channel_id text,
  whatsapp_phone_number text,
  ses_verified_domain text,
  mollie_customer_id text,
  subscription_tier text default 'starter'
    check (subscription_tier in ('trial','starter','growth','scale')),
  subscription_status text default 'trial'
    check (subscription_status in ('trial','active','past_due','cancelled')),
  trial_ends_at timestamptz,
  onboarding_completed boolean default false,
  settings jsonb default '{
    "business_hours": {"start": "09:00", "end": "17:00"},
    "timezone": "Europe/Amsterdam",
    "auto_respond": true,
    "language": "nl",
    "return_negotiation_enabled": true,
    "negotiation_offers": [
      {"step": 1, "type": "partial_refund", "percentage": 20},
      {"step": 2, "type": "partial_refund", "percentage": 35},
      {"step": 3, "type": "store_credit", "percentage": 50}
    ],
    "escalation_email": null,
    "proactive_check_enabled": true,
    "proactive_check_delay_hours": 48
  }'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
