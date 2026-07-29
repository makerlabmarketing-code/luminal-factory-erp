import 'server-only';

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { getSupabaseUrl } from './env';

export type AdminClientFailureCode =
  | 'admin_client_configuration_failed'
  | 'admin_client_creation_failed';

export class AdminClientError extends Error {
  constructor(public readonly code: AdminClientFailureCode, cause?: unknown) {
    super(code, { cause });
    this.name = 'AdminClientError';
  }
}

function jwtRole(key: string): string | null {
  try {
    const payload = key.split('.')[1];
    if (!payload) return null;
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')).role ?? null;
  } catch {
    return null;
  }
}

export function getSupabaseAdminKey(): string {
  // Supabase's current secret key name is preferred; retain the established
  // service-role variable so existing production environments do not lose the
  // privileged server boundary during key-name migration.
  const current = process.env.SUPABASE_SECRET_KEY?.trim();
  const legacy = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const key = current || legacy;

  if (!key) {
    throw new AdminClientError('admin_client_configuration_failed');
  }

  const publicKeys = [
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  ].filter(Boolean);
  if (key.startsWith('sb_publishable_') || publicKeys.includes(key) || jwtRole(key) === 'anon') {
    throw new AdminClientError('admin_client_configuration_failed');
  }

  return key;
}

export function createSupabaseAdminClient(factory: typeof createSupabaseClient = createSupabaseClient) {
  let url: string;
  let key: string;
  try {
    url = getSupabaseUrl();
    key = getSupabaseAdminKey();
    new URL(url);
  } catch (error) {
    if (error instanceof AdminClientError) throw error;
    throw new AdminClientError('admin_client_configuration_failed', error);
  }

  try {
    return factory(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  } catch (error) {
    throw new AdminClientError('admin_client_creation_failed', error);
  }
}
