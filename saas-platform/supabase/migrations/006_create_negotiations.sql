do $$
begin
  if not exists (select 1 from pg_type where typname = 'negotiation_status') then
    create type negotiation_status as enum (
      'initiated', 'offer_sent', 'offer_accepted',
      'offer_rejected', 'escalated', 'return_initiated',
      'completed', 'expired'
    );
  end if;
end $$;

create table if not exists negotiations (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid references merchants(id) on delete cascade not null,
  conversation_id uuid references conversations(id) on delete cascade not null,
  customer_id uuid references customers(id) on delete cascade not null,
  order_id uuid references orders(id) on delete set null,
  status negotiation_status default 'initiated',
  current_step integer default 0,
  max_steps integer default 3,
  offers jsonb default '[]',
  product_cost decimal(10,2),
  estimated_return_cost decimal(10,2),
  final_refund_amount decimal(10,2),
  final_refund_type text,
  shopify_refund_id text,
  return_reason text,
  customer_feedback text,
  savings decimal(10,2),
  audit_pdf_url text,
  completed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_negotiations_merchant on negotiations(merchant_id);
create index if not exists idx_negotiations_conversation on negotiations(conversation_id);
create index if not exists idx_negotiations_status on negotiations(merchant_id, status);
