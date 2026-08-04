import 'server-only';

import { createClient } from '@/utils/supabase/server';
import { createSupabaseAdminClient } from '@/utils/supabase/admin';
import { AuthFlowError, hasPermission, requireWorkspaceAccess } from '@/services/server/auth';
import { loadFacilityDirectory } from '@/services/server/facilityDirectory';

export interface AdminFacilityDto {
  id: number | string;
  facilityName: string;
  address: string | null;
  lat: number | string | null;
  lng: number | string | null;
  radius: number | string | null;
  code: string | null;
  isActive: boolean | null;
}

type FacilityRow = {
  id: number | string;
  facility_name?: string | null;
  address?: string | null;
  lat?: number | string | null;
  lng?: number | string | null;
  radius?: number | string | null;
  code?: string | null;
  is_active?: boolean | null;
};

type FacilityPayload = {
  facility_name: string;
  address: string;
  lat: number;
  lng: number;
  radius: number;
  code?: string;
  is_active?: boolean;
};

const BASE_FACILITY_SELECT = 'id, facility_name, address, lat, lng, radius';
const ACTIVE_FACILITY_SELECT = `${BASE_FACILITY_SELECT}, code, is_active`;

function isFacilityActiveStateEnabled() {
  return process.env.FACILITY_ACTIVE_STATE_ENABLED === 'true';
}

function assertFacilityMutationEnabled() {
  if (!isFacilityActiveStateEnabled()) {
    throw new AuthFlowError({
      status: 503,
      code: 'facility_schema_unavailable',
      message: 'Chức năng cập nhật cơ sở đang chờ kích hoạt.',
      failureStage: 'persistence',
    });
  }
}

function getFacilitySelect() {
  return isFacilityActiveStateEnabled() ? ACTIVE_FACILITY_SELECT : BASE_FACILITY_SELECT;
}

function normalizeFacilityCode(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64) || 'FACILITY';
}

function logFacilityPersistenceError(stage: string, error: unknown) {
  const safeError = error && typeof error === 'object'
    ? {
        code: 'code' in error ? String(error.code || 'unknown') : 'unknown',
        message: 'message' in error ? String(error.message || '').slice(0, 240) : 'unknown',
        details: 'details' in error ? String(error.details || '').slice(0, 240) : null,
      }
    : { code: 'unknown', message: String(error).slice(0, 240), details: null };

  console.error('[facility-persistence]', { stage, error: safeError });
}

function toFacilityPersistenceFailure(message = 'Không thể lưu cơ sở làm việc. Vui lòng thử lại.') {
  return new AuthFlowError({
    status: 500,
    code: 'facility_persistence_failed',
    message,
    failureStage: 'persistence',
  });
}

async function createUniqueFacilityCode(facilityName: string): Promise<string> {
  const supabaseAdmin = createSupabaseAdminClient();
  const baseCode = normalizeFacilityCode(facilityName);
  const { data, error } = await supabaseAdmin
    .from('facilities')
    .select('code')
    .ilike('code', `${baseCode}%`);

  if (error) {
    logFacilityPersistenceError('facility_code_lookup', error);
    throw toFacilityPersistenceFailure();
  }

  const existingCodes = new Set(((data || []) as Array<{ code?: string | null }>).map((row) => row.code));
  if (!existingCodes.has(baseCode)) return baseCode;

  for (let suffix = 2; suffix < 1000; suffix += 1) {
    const candidate = `${baseCode}_${suffix}`;
    if (!existingCodes.has(candidate)) return candidate;
  }

  throw new AuthFlowError({
    status: 409,
    code: 'facility_persistence_failed',
    message: 'Không thể tạo mã cơ sở duy nhất. Vui lòng đổi tên cơ sở.',
    failureStage: 'persistence',
  });
}

async function requireFacilityView() {
  const authContext = await requireWorkspaceAccess('ADMIN_WORKSPACE');
  const canViewSettings = await hasPermission(authContext, 'SYSTEM_SETTINGS_VIEW');
  const canManageAttendance = await hasPermission(authContext, 'ATTENDANCE_MANAGE');

  if (!canViewSettings && !canManageAttendance) {
    throw new AuthFlowError({
      status: 403,
      code: 'permission_forbidden',
      message: 'Bạn không có quyền xem cơ sở làm việc.',
      failureStage: 'permission_check',
    });
  }

  return authContext;
}

async function requireFacilityManage() {
  const authContext = await requireWorkspaceAccess('ADMIN_WORKSPACE');
  const canManageSettings = await hasPermission(authContext, 'SYSTEM_SETTINGS_MANAGE');
  const canManageAttendance = await hasPermission(authContext, 'ATTENDANCE_MANAGE');

  if (!canManageSettings && !canManageAttendance) {
    throw new AuthFlowError({
      status: 403,
      code: 'permission_forbidden',
      message: 'Bạn không có quyền cập nhật cơ sở làm việc.',
      failureStage: 'permission_check',
    });
  }

  return authContext;
}

function toFacilityDto(row: FacilityRow): AdminFacilityDto {
  return {
    id: row.id,
    facilityName: row.facility_name || 'Chưa đặt tên',
    address: row.address || null,
    lat: row.lat ?? null,
    lng: row.lng ?? null,
    radius: row.radius ?? null,
    code: row.code || null,
    isActive: row.is_active ?? null,
  };
}

function readString(body: Record<string, unknown>, key: string): string {
  const value = body[key];
  return typeof value === 'string' ? value.trim() : '';
}

function readCoordinate(body: Record<string, unknown>, key: 'lat' | 'lng'): number {
  const value = body[key];
  const parsed = typeof value === 'number' ? value : Number(typeof value === 'string' ? value.trim() : NaN);

  if (!Number.isFinite(parsed)) {
    throw new AuthFlowError({
      status: 400,
      code: 'payload_validation_failed',
      message: 'Vui lòng nhập tọa độ hợp lệ cho cơ sở làm việc.',
      failureStage: 'payload_validation',
    });
  }

  return parsed;
}

function readRadius(body: Record<string, unknown>): number {
  const value = body.radius;
  const parsed = typeof value === 'number' ? value : Number(typeof value === 'string' ? value.trim() : NaN);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new AuthFlowError({
      status: 400,
      code: 'payload_validation_failed',
      message: 'Bán kính chấm công phải lớn hơn 0 mét.',
      failureStage: 'payload_validation',
    });
  }

  return parsed;
}

function parseFacilityPayload(body: Record<string, unknown>): FacilityPayload {
  const facilityName = readString(body, 'facilityName');
  const address = readString(body, 'address');

  if (!facilityName || !address) {
    throw new AuthFlowError({
      status: 400,
      code: 'payload_validation_failed',
      message: 'Vui lòng nhập tên và địa chỉ cơ sở làm việc.',
      failureStage: 'payload_validation',
    });
  }

  return {
    facility_name: facilityName,
    address,
    lat: readCoordinate(body, 'lat'),
    lng: readCoordinate(body, 'lng'),
    radius: readRadius(body),
  };
}

function parseFacilityId(value: unknown): string | number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) return value.trim();

  throw new AuthFlowError({
    status: 400,
    code: 'payload_validation_failed',
    message: 'Thiếu mã cơ sở làm việc.',
    failureStage: 'payload_validation',
  });
}

export async function listAdminFacilities() {
  await requireFacilityView();
  // Use the already-authorized request session for this user-facing read. This
  // avoids turning an optional server secret into a requirement for the page and
  // keeps the database RLS policy as a second authorization boundary.
  const directory = await loadFacilityDirectory(await createClient());
  return {
    success: true,
    capabilities: {
      canPersistStatusAndCode: directory.canPersistStatusAndCode,
      canManageFacilities: directory.canPersistStatusAndCode && isFacilityActiveStateEnabled(),
    },
    facilities: directory.facilities.map((facility) => ({
      id: facility.id,
      facilityName: facility.name,
      address: facility.address,
      lat: facility.lat,
      lng: facility.lng,
      radius: facility.radius,
      code: facility.code,
      isActive: facility.isActive,
    })),
  };
}

export async function createAdminFacility(body: Record<string, unknown>) {
  await requireFacilityManage();
  assertFacilityMutationEnabled();
  const parsedPayload = parseFacilityPayload(body);
  const payload: FacilityPayload = {
    ...parsedPayload,
    code: await createUniqueFacilityCode(parsedPayload.facility_name),
    is_active: true,
  };
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('facilities')
    .insert(payload)
    .select(getFacilitySelect())
    .single();

  if (error) {
    logFacilityPersistenceError('facility_create', error);
    throw toFacilityPersistenceFailure();
  }

  return { success: true, facility: toFacilityDto(data as unknown as FacilityRow) };
}

export async function updateAdminFacility(body: Record<string, unknown>) {
  await requireFacilityManage();
  assertFacilityMutationEnabled();
  const facilityId = parseFacilityId(body.id);
  const payload = parseFacilityPayload(body);
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('facilities')
    .update(payload)
    .eq('id', facilityId)
    .select(getFacilitySelect())
    .single();

  if (error) {
    logFacilityPersistenceError('facility_update', error);
    throw toFacilityPersistenceFailure();
  }

  return { success: true, facility: toFacilityDto(data as unknown as FacilityRow) };
}

export async function deleteAdminFacility(body: Record<string, unknown>) {
  await requireFacilityManage();
  assertFacilityMutationEnabled();
  const facilityId = parseFacilityId(body.id);
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from('facilities').delete().eq('id', facilityId);

  if (error) {
    logFacilityPersistenceError('facility_delete', error);
    throw new AuthFlowError({
      status: 500,
      code: 'facility_persistence_failed',
      message: 'Không thể xóa cơ sở làm việc. Vui lòng kiểm tra nhân sự đang được gán vào cơ sở này.',
      failureStage: 'persistence',
    });
  }

  return { success: true, deletedId: facilityId };
}
