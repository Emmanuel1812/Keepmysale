create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid references merchants(id) on delete cascade not null,
  email text,
  phone text,
  name text,
  shopify_customer_id text,
  language text default 'nl',
  metadata jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(merchant_id, email),
  unique(merchant_id, phone)
);

create index if not exists idx_customers_merchant on customers(merchant_id);
create index if not exists idx_customers_email on customers(merchant_id, email);
create index if not exists idx_customers_phone on customers(merchant_id, phone);
