create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid references merchants(id) on delete cascade not null,
  shopify_order_id text not null,
  shopify_order_number text,
  customer_id uuid references customers(id) on delete set null,
  email text,
  financial_status text,
  fulfillment_status text,
  total_price decimal(10,2),
  currency text default 'EUR',
  line_items jsonb default '[]',
  tracking_number text,
  tracking_url text,
  tracking_company text,
  delivered_at timestamptz,
  proactive_check_sent boolean default false,
  synced_at timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(merchant_id, shopify_order_id)
);

create index if not exists idx_orders_merchant on orders(merchant_id);
create index if not exists idx_orders_customer on orders(customer_id);
create index if not exists idx_orders_shopify_id on orders(merchant_id, shopify_order_id);
