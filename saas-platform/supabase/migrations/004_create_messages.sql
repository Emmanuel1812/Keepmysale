do $$
begin
  if not exists (select 1 from pg_type where typname = 'message_sender') then
    create type message_sender as enum ('customer', 'ai', 'human_agent', 'system');
  end if;
end $$;

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references conversations(id) on delete cascade not null,
  merchant_id uuid references merchants(id) on delete cascade not null,
  sender message_sender not null,
  channel conversation_channel not null,
  content text not null,
  content_html text,
  external_message_id text,
  attachments jsonb default '[]',
  ai_confidence float,
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

create index if not exists idx_messages_conversation on messages(conversation_id);
create index if not exists idx_messages_merchant on messages(merchant_id);
