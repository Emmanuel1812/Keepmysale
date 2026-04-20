import os, sys
sys.path.append(os.path.join(os.getcwd(), 'scripts'))
from test_email_pipeline import get_supabase_client

supabase = get_supabase_client()
if supabase:
    negs = supabase.table('negotiations').select('id, current_step, max_steps, status, offers').order('updated_at', desc=True).limit(5).execute()
    for n in negs.data:
        print(f"Neg {n['id']}: step {n['current_step']}/{n['max_steps']}, status: {n['status']}")
        for o in n.get('offers', []):
            print(f"  - Offer step {o.get('step')}: {o.get('percentage')}% ({o.get('response')})")
