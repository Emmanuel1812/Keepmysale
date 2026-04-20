import os, sys
sys.path.append(os.path.join(os.getcwd(), 'scripts'))
from test_email_pipeline import get_supabase_client

supabase = get_supabase_client()

print("=" * 80)
print("QUERY 1: LAST 20 MESSAGES (no time filter)")
print("=" * 80)
msgs = (supabase.table("messages")
    .select("conversation_id, sender, content, created_at, metadata")
    .order("created_at", desc=True)
    .limit(20)
    .execute())

for i, m in enumerate(reversed(msgs.data)):
    content_preview = (m['content'] or '')[:80].replace('\n', ' ').replace('\r', '')
    meta = m.get('metadata') or {}
    neg_dec = meta.get('negotiation_decision', '-')
    req_human = meta.get('requires_human', '-')
    intent = meta.get('intent', '-')
    print(f"\n  [{i+1}] conv_id:  {m['conversation_id']}")
    print(f"      sender:   {m['sender']}")
    print(f"      content:  {content_preview}")
    print(f"      time:     {m['created_at']}")
    print(f"      intent: {intent}  |  neg_dec: {neg_dec}  |  requires_human: {req_human}")

print(f"\nTotal shown: {len(msgs.data)}")

print("\n" + "=" * 80)
print("QUERY 2: ALL NEGOTIATIONS (no time filter, last 10)")
print("=" * 80)
negs = (supabase.table("negotiations")
    .select("id, conversation_id, status, current_step, max_steps, updated_at, created_at")
    .order("updated_at", desc=True)
    .limit(10)
    .execute())

for n in reversed(negs.data):
    print(f"\n  Neg ID:          {n['id']}")
    print(f"  conversation_id: {n['conversation_id']}")
    print(f"  status:          {n['status']}")
    print(f"  current_step:    {n['current_step']} / {n['max_steps']}")
    print(f"  created_at:      {n['created_at']}")
    print(f"  updated_at:      {n['updated_at']}")

if not negs.data:
    print("\n  (No negotiations found at all)")

print("\n" + "=" * 80)
print("QUERY 3: LAST 10 CONVERSATIONS")
print("=" * 80)
convs = (supabase.table("conversations")
    .select("id, customer_id, subject, status, created_at, updated_at")
    .order("updated_at", desc=True)
    .limit(10)
    .execute())

for c in reversed(convs.data):
    print(f"\n  Conv ID:     {c['id']}")
    print(f"  subject:     {c['subject']}")
    print(f"  status:      {c['status']}")
    print(f"  created_at:  {c['created_at']}")

# Now check: how many distinct conversation_ids appear in the return_negotiation messages?
print("\n" + "=" * 80)
print("QUERY 4: MESSAGES with 'retour' or 'snowboard' in subject-related content")
print("=" * 80)
all_msgs = (supabase.table("messages")
    .select("conversation_id, sender, content, created_at, metadata")
    .order("created_at", desc=True)
    .limit(100)
    .execute())

retour_msgs = [m for m in all_msgs.data if 'retour' in (m['content'] or '').lower() 
               or 'snowboard' in (m['content'] or '').lower()
               or 'terugbetaling' in (m['content'] or '').lower()
               or '20%' in (m['content'] or '')
               or '35%' in (m['content'] or '')
               or '45%' in (m['content'] or '')]

conv_ids_seen = set()
for m in reversed(retour_msgs):
    conv_ids_seen.add(m['conversation_id'])
    content_preview = (m['content'] or '')[:100].replace('\n', ' ').replace('\r', '')
    meta = m.get('metadata') or {}
    neg_dec = meta.get('negotiation_decision', '-')
    print(f"\n  conv_id: {m['conversation_id']}")
    print(f"  sender:  {m['sender']}  |  neg_dec: {neg_dec}")
    print(f"  content: {content_preview}")
    print(f"  time:    {m['created_at']}")

print(f"\n  DISTINCT conversation_ids for negotiation messages: {len(conv_ids_seen)}")
for cid in conv_ids_seen:
    print(f"    - {cid}")
