import { createClient } from '@supabase/supabase-js';

// Lazy public client — deferred so module evaluation during `next build`
// doesn't throw when NEXT_PUBLIC_* env vars are absent in the build worker.
export function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Supabase public env vars are not set.');
  return createClient(url, key);
}

// Admin client for secure operations (generating signed URLs, etc.)
// Only use this in server-side API routes!
export function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) throw new Error('Supabase admin env vars are not set.');
  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
