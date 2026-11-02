import { createBrowserClient } from '@supabase/ssr';
import { publicEnv } from '@/lib/env/public';

export function createClient() {
  const url = publicEnv.NEXT_PUBLIC_SUPABASE_URL;
  const key = publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error('Supabase public environment variables are not set.');
  }
  return createBrowserClient(url, key);
}
