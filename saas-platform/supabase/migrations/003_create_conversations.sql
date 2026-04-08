do $$
begin
  if not exists (select 1 from pg_type where typname = 'conversation_status') then
    create type conversation_status as enum (
      'open', 'pending_ai', 'pending_human',
      'negotiating', 'resolved', 'closed'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'conversation_channel') then
    create type conversation_channel as enum ('whatsapp', 'email');
  end if;
end $$;

create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid references merchants(id) on delete cascade not null,
  customer_id uuid references customers(id) on delete cascade not null,
  channel conversation_channel not null,
  status conversation_status default 'open',
  subject text,
  intent text,
  assigned_to uuid references auth.users(id) on delete set null,
  ai_resolved boolean default false,
  shopify_order_id text,
  last_message_at timestamptz default now(),
  resolved_at timestamptz,
  metadata jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_conversations_merchant on conversations(merchant_id);
create index if not exists idx_conversations_status on conversations(merchant_id, status);
create index if not exists idx_conversations_customer on conversations(customer_id);
