-- Add payment_gateway to orders table
alter table orders add column if not exists payment_gateway text;

-- Add index for payment_gateway for faster filtering if needed
create index if not exists idx_orders_payment_gateway on orders(payment_gateway);
