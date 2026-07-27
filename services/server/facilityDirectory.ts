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

function toDirectoryItem(row: FacilityRow): FacilityDirectoryItem {
  return {
    id: String(row.id),
    code: (row.code || String(row.id)).trim(),
    name: (row.facility_name || 'Chưa đặt tên').trim(),
    address: row.address || null,
    lat: row.lat ?? null,
    lng: row.lng ?? null,
    radius: row.radius ?? null,
    isActive: row.is_active !== false,
  };
}

/** Server-only directory read. Callers must authorize the workspace before calling. */
export const getFacilityDirectory = cache(async (): Promise<FacilityDirectoryItem[]> => {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('facilities')
    .select(FACILITY_SELECT)
    .order('facility_name', { ascending: true });

  if (error) {
    throw new AuthFlowError({
      status: 500,
      code: 'admin_verification_failed',
      message: 'Không thể tải danh sách cơ sở làm việc.',
      failureStage: 'persistence',
    });
  }

  return ((data || []) as unknown as FacilityRow[]).map(toDirectoryItem);
});

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
