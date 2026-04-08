create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create or replace function get_merchant_id_for_user()
returns uuid as $$
  select id from merchants where supabase_user_id = auth.uid() limit 1;
$$ language sql stable security definer;

drop trigger if exists trg_merchants_updated_at on merchants;
create trigger trg_merchants_updated_at
before update on merchants
for each row execute function update_updated_at();

drop trigger if exists trg_customers_updated_at on customers;
create trigger trg_customers_updated_at
before update on customers
for each row execute function update_updated_at();

drop trigger if exists trg_conversations_updated_at on conversations;
create trigger trg_conversations_updated_at
before update on conversations
for each row execute function update_updated_at();

drop trigger if exists trg_orders_updated_at on orders;
create trigger trg_orders_updated_at
before update on orders
for each row execute function update_updated_at();

drop trigger if exists trg_negotiations_updated_at on negotiations;
create trigger trg_negotiations_updated_at
before update on negotiations
for each row execute function update_updated_at();

drop trigger if exists trg_kb_updated_at on knowledge_base;
create trigger trg_kb_updated_at
before update on knowledge_base
for each row execute function update_updated_at();

create or replace function sync_conversation_on_message_insert()
returns trigger as $$
begin
  update conversations
  set
    last_message_at = now(),
    status = case
      when new.sender = 'customer' and status in ('resolved', 'closed') then 'open'
      else status
    end,
    updated_at = now()
  where id = new.conversation_id;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_messages_after_insert on messages;
create trigger trg_messages_after_insert
after insert on messages
for each row execute function sync_conversation_on_message_insert();

alter table merchants enable row level security;
alter table customers enable row level security;
alter table conversations enable row level security;
alter table messages enable row level security;
alter table orders enable row level security;
alter table negotiations enable row level security;
alter table refund_logs enable row level security;
alter table knowledge_base enable row level security;

drop policy if exists merchants_select_own on merchants;
create policy merchants_select_own on merchants
for select using (id = get_merchant_id_for_user());
drop policy if exists merchants_update_own on merchants;
create policy merchants_update_own on merchants
for update using (id = get_merchant_id_for_user());

drop policy if exists customers_select_own on customers;
create policy customers_select_own on customers
for select using (merchant_id = get_merchant_id_for_user());
drop policy if exists customers_insert_own on customers;
create policy customers_insert_own on customers
for insert with check (merchant_id = get_merchant_id_for_user());
drop policy if exists customers_update_own on customers;
create policy customers_update_own on customers
for update using (merchant_id = get_merchant_id_for_user());
drop policy if exists customers_delete_own on customers;
create policy customers_delete_own on customers
for delete using (merchant_id = get_merchant_id_for_user());

drop policy if exists conversations_select_own on conversations;
create policy conversations_select_own on conversations
for select using (merchant_id = get_merchant_id_for_user());
drop policy if exists conversations_insert_own on conversations;
create policy conversations_insert_own on conversations
for insert with check (merchant_id = get_merchant_id_for_user());
drop policy if exists conversations_update_own on conversations;
create policy conversations_update_own on conversations
for update using (merchant_id = get_merchant_id_for_user());

drop policy if exists messages_select_own on messages;
create policy messages_select_own on messages
for select using (merchant_id = get_merchant_id_for_user());
drop policy if exists messages_insert_own on messages;
create policy messages_insert_own on messages
for insert with check (merchant_id = get_merchant_id_for_user());

drop policy if exists orders_select_own on orders;
create policy orders_select_own on orders
for select using (merchant_id = get_merchant_id_for_user());
drop policy if exists orders_insert_own on orders;
create policy orders_insert_own on orders
for insert with check (merchant_id = get_merchant_id_for_user());
drop policy if exists orders_update_own on orders;
create policy orders_update_own on orders
for update using (merchant_id = get_merchant_id_for_user());

drop policy if exists negotiations_select_own on negotiations;
create policy negotiations_select_own on negotiations
for select using (merchant_id = get_merchant_id_for_user());
drop policy if exists negotiations_insert_own on negotiations;
create policy negotiations_insert_own on negotiations
for insert with check (merchant_id = get_merchant_id_for_user());
drop policy if exists negotiations_update_own on negotiations;
create policy negotiations_update_own on negotiations
for update using (merchant_id = get_merchant_id_for_user());

drop policy if exists refund_logs_select_own on refund_logs;
create policy refund_logs_select_own on refund_logs
for select using (merchant_id = get_merchant_id_for_user());
drop policy if exists refund_logs_insert_own on refund_logs;
create policy refund_logs_insert_own on refund_logs
for insert with check (merchant_id = get_merchant_id_for_user());

drop policy if exists knowledge_base_select_own on knowledge_base;
create policy knowledge_base_select_own on knowledge_base
for select using (merchant_id = get_merchant_id_for_user());
drop policy if exists knowledge_base_insert_own on knowledge_base;
create policy knowledge_base_insert_own on knowledge_base
for insert with check (merchant_id = get_merchant_id_for_user());
drop policy if exists knowledge_base_update_own on knowledge_base;
create policy knowledge_base_update_own on knowledge_base
for update using (merchant_id = get_merchant_id_for_user());
drop policy if exists knowledge_base_delete_own on knowledge_base;
create policy knowledge_base_delete_own on knowledge_base
for delete using (merchant_id = get_merchant_id_for_user());
