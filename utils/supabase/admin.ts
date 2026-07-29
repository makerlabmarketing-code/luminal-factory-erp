import 'server-only';

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { getSupabaseUrl } from './env';

function getSupabaseAdminKey(): string {
  // Supabase's current secret key name is preferred; retain the established
  // service-role variable so existing production environments do not lose the
  // privileged server boundary during key-name migration.
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!key) {
    throw new Error('Thiếu cấu hình Supabase secret key cho thao tác tài khoản.');
  }

  return key;
}

export function createSupabaseAdminClient() {
  return createSupabaseClient(getSupabaseUrl(), getSupabaseAdminKey(), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
