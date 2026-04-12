-- Add ai_draft to message_sender enum
alter type message_sender add value if not exists 'ai_draft';

-- Add last_message_sender_type to conversations for fast filtering
alter table conversations add column if not exists last_message_sender_type message_sender;

-- Trigger to update last_message_sender_type automatically
create or replace function update_last_message_sender()
returns trigger as $$
begin
  update conversations
  set last_message_sender_type = new.sender,
      last_message_at = new.created_at,
      updated_at = now()
  where id = new.conversation_id;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trigger_update_last_message_sender on messages;
create trigger trigger_update_last_message_sender
after insert on messages
for each row
execute function update_last_message_sender();

-- Backfill existing conversations
update conversations c
set last_message_sender_type = (
  select sender from messages 
  where conversation_id = c.id 
  order by created_at desc 
  limit 1
)
where last_message_sender_type is null;
