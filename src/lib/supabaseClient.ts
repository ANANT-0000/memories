import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Client for public operations (if any) or authenticated operations
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Admin client for secure operations (generating signed URLs, etc.)
// Only use this in server-side API routes!
export function getAdminSupabase() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
