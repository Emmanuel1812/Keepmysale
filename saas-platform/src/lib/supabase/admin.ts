import { createClient } from "@supabase/supabase-js";
import { getEnv } from "@/lib/env";

export function createSupabaseAdminClient() {
  const env = getEnv();
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}
