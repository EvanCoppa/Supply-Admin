import { createClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/private';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';

export function createSupabaseAdminClient() {
  const key = env['SUPABASE_SERVICE_ROLE_KEY'] ?? env['PRIVATE_SUPABASE_SERVICE_ROLE_KEY'];
  if (!key) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY must be set for integration API routes.');
  }

  return createClient(PUBLIC_SUPABASE_URL, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}
