import { createClient } from "@supabase/supabase-js";
import { getEnv } from "@/lib/env";

export function createSupabaseBrowserClient() {
  const env = getEnv();
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
