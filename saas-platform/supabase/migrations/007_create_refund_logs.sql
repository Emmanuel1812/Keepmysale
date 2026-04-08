create table if not exists refund_logs (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid references merchants(id) on delete cascade not null,
  negotiation_id uuid references negotiations(id) on delete set null,
  order_id uuid references orders(id) on delete set null,
  customer_id uuid references customers(id) on delete set null,
  action text not null,
  amount decimal(10,2),
  currency text default 'EUR',
  shopify_refund_id text,
  shopify_transaction_id text,
  channel conversation_channel,
  customer_consent_recorded boolean default false,
  audit_details jsonb default '{}',
  created_at timestamptz default now()
);

create index if not exists idx_refund_logs_merchant on refund_logs(merchant_id);
create index if not exists idx_refund_logs_negotiation on refund_logs(negotiation_id);
