import * as dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { createSupabaseAdminClient } from '../src/lib/supabase/admin';

async function main() {
    const supabase = createSupabaseAdminClient();
    const { data: msgs, error } = await supabase.from('messages').select('*').order('created_at', { ascending: false }).limit(5);
    
    if (error) {
        console.error("DB error:", error);
    } else {
        console.log("LAST 5 MESSAGES:");
        msgs.forEach(m => {
            console.log(`[${m.sender}] Content: ${m.content?.substring(0, 50)}...`);
            console.log(`Metadata:`, m.metadata);
            console.log("------------------------");
        });
    }
}
main().catch(console.error);
