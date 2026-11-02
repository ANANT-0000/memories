import { createClient as createBrowserSupabase } from '@/lib/supabase/client';
import { getAdminClient } from '@/lib/supabase/admin';

export function getSupabase() {
  return createBrowserSupabase();
}

export function getAdminSupabase() {
  return getAdminClient();
}
