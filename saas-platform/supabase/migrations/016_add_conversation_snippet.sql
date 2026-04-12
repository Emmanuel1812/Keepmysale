-- Migration: Add last_message_content and robust trigger sync
alter table conversations add column if not exists last_message_content text;

-- Update the existing trigger function to be more inclusive
create or replace function update_last_message_sender()
returns trigger as $$
begin
  update conversations
  set last_message_sender_type = new.sender,
      last_message_at = new.created_at,
      last_message_content = substring(new.content from 1 for 255), -- Save snippet
      updated_at = now()
  where id = new.conversation_id;
  return new;
end;
$$ language plpgsql;

-- Backfill existing conversations with snippets from latest messages
update conversations c
set 
  last_message_sender_type = m.sender,
  last_message_at = m.created_at,
  last_message_content = substring(m.content from 1 for 255)
from (
  select distinct on (conversation_id) conversation_id, sender, created_at, content
  from messages
  order by conversation_id, created_at desc
) m
where c.id = m.conversation_id;
