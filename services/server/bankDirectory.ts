import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  BANK_DIRECTORY_METADATA_NAME,
  DEFAULT_BANK_DIRECTORY,
  normalizeSystemMetadataOptions,
  type SystemMetadataOption,
} from '../../lib/system-metadata-defaults';

export interface BankDirectoryResult {
  options: SystemMetadataOption[];
  lookupFailed: boolean;
}

export async function loadBankDirectory(
  supabase: SupabaseClient
): Promise<BankDirectoryResult> {
  try {
    let query = supabase
      .from('system_metadata')
      .select('data')
      .eq('name', BANK_DIRECTORY_METADATA_NAME);
    if (process.env.SYSTEM_RECORD_LIFECYCLE_ENABLED === 'true') query = query.eq('is_active', true);
    const { data, error } = await query.maybeSingle();

    return {
      options: normalizeSystemMetadataOptions(data?.data, DEFAULT_BANK_DIRECTORY),
      lookupFailed: Boolean(error),
    };
  } catch {
    return {
      options: [...DEFAULT_BANK_DIRECTORY],
      lookupFailed: true,
    };
  }
}
