import 'server-only';

import { cache } from 'react';
import { createSupabaseAdminClient } from '@/utils/supabase/admin';
import { AuthFlowError } from '@/services/server/auth';

export interface FacilityDirectoryItem {
  id: string;
  code: string;
  name: string;
  address: string | null;
  lat: number | string | null;
  lng: number | string | null;
  radius: number | string | null;
  isActive: boolean;
}

type FacilityRow = {
  id: number | string;
  facility_name: string | null;
  code: string | null;
  is_active: boolean | null;
  address: string | null;
  lat: number | string | null;
  lng: number | string | null;
  radius: number | string | null;
};

const FACILITY_SELECT = 'id, facility_name, code, is_active, address, lat, lng, radius';
const LEGACY_FACILITY_SELECT = 'id, facility_name, address, lat, lng, radius';

export interface FacilityDirectoryResult {
  facilities: FacilityDirectoryItem[];
  canPersistStatusAndCode: boolean;
}

export function isKnownMissingFacilityColumn(error: { code?: string | null; message?: string | null }): boolean {
  if (error.code === '42703' || error.code === 'PGRST204') return true;
  const message = (error.message || '').toLowerCase();
  return message.includes('column') && (message.includes('code') || message.includes('is_active')) && message.includes('does not exist');
}

export function toFacilityDirectoryItem(row: FacilityRow): FacilityDirectoryItem {
  return {
    id: String(row.id),
    code: (row.code || '').trim(),
    name: (row.facility_name || 'Chưa đặt tên').trim(),
    address: row.address || null,
    lat: row.lat ?? null,
    lng: row.lng ?? null,
    radius: row.radius ?? null,
    isActive: row.is_active !== false,
  };
}

/** Server-only directory read. Callers must authorize the workspace before calling. */
export const getFacilityDirectoryResult = cache(async (): Promise<FacilityDirectoryResult> => {
  const supabase = createSupabaseAdminClient();
  const current = await supabase
    .from('facilities')
    .select(FACILITY_SELECT)
    .order('facility_name', { ascending: true });

  if (!current.error) {
    return { facilities: ((current.data || []) as unknown as FacilityRow[]).map(toFacilityDirectoryItem), canPersistStatusAndCode: true };
  }

  if (!isKnownMissingFacilityColumn(current.error)) {
    throw new AuthFlowError({
      status: 500,
      code: 'facility_list_load_failed',
      message: 'Không thể tải danh sách cơ sở làm việc.',
      failureStage: 'persistence',
      safeDetails: { supabase_error_code: current.error.code || 'unknown' },
    });
  }

  const legacy = await supabase
    .from('facilities')
    .select(LEGACY_FACILITY_SELECT)
    .order('facility_name', { ascending: true });

  if (legacy.error) {
    throw new AuthFlowError({ status: 500, code: 'facility_schema_unavailable', message: 'Không thể tải danh sách cơ sở làm việc.', failureStage: 'persistence', safeDetails: { supabase_error_code: legacy.error.code || 'unknown' } });
  }

  return { facilities: ((legacy.data || []) as unknown as FacilityRow[]).map(toFacilityDirectoryItem), canPersistStatusAndCode: false };
});

export const getFacilityDirectory = cache(async () => (await getFacilityDirectoryResult()).facilities);

export function findFacility(
  facilities: FacilityDirectoryItem[],
  value?: string | null
): FacilityDirectoryItem | null {
  const normalized = (value || '').trim().toLowerCase();
  if (!normalized) return null;

  return facilities.find((facility) =>
    [facility.id, facility.code, facility.name].some((candidate) => candidate.toLowerCase() === normalized)
  ) || null;
}
