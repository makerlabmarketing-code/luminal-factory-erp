import { NextResponse } from 'next/server';

import { mergeSystemMetadataCategories } from '@/lib/system-metadata-defaults';
import { AuthFlowError, hasPermission, requireSystemOwner, requireWorkspaceAccess } from '@/services/server/auth';
import { createSupabaseAdminClient } from '@/utils/supabase/admin';

type MetadataPayload = {
  id?: unknown;
  name?: unknown;
  data?: unknown;
  lifecycleAction?: unknown;
};

const BASE_METADATA_SELECT = 'id, name, data, created_at';
const LIFECYCLE_METADATA_SELECT = `${BASE_METADATA_SELECT}, is_active, deactivated_at`;

function isLifecycleEnabled() {
  return process.env.SYSTEM_RECORD_LIFECYCLE_ENABLED === 'true';
}

function requireLifecycleEnabled() {
  if (!isLifecycleEnabled()) {
    throw new AuthFlowError({
      status: 503,
      code: 'service_unavailable',
      message: 'Chức năng ngừng hoạt động đang chờ kích hoạt.',
      failureStage: 'persistence',
    });
  }
}

function jsonNoStore(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

async function requireSystemSettingsPermission(
  permissionCode: 'SYSTEM_SETTINGS_VIEW' | 'SYSTEM_SETTINGS_MANAGE'
) {
  const authContext = await requireWorkspaceAccess('ADMIN_WORKSPACE');
  if (!(await hasPermission(authContext, permissionCode))) {
    throw new AuthFlowError({
      status: 403,
      code: 'permission_forbidden',
      message:
        permissionCode === 'SYSTEM_SETTINGS_VIEW'
          ? 'Bạn không có quyền xem danh mục hệ thống.'
          : 'Bạn không có quyền quản lý danh mục hệ thống.',
      failureStage: 'permission_check',
    });
  }
  return authContext;
}

function numericId(value: unknown): number | null {
  const numberValue = typeof value === 'number' ? value : Number(value);
  return Number.isSafeInteger(numberValue) && numberValue > 0 ? numberValue : null;
}

function requiredName(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new AuthFlowError({
      status: 400,
      code: 'payload_validation_failed',
      message: 'Tên danh mục không hợp lệ.',
      failureStage: 'payload_validation',
    });
  }
  return value.trim();
}

function requiredData(value: unknown): Array<Record<string, string | number>> {
  if (!Array.isArray(value)) {
    throw new AuthFlowError({
      status: 400,
      code: 'payload_validation_failed',
      message: 'Dữ liệu danh mục không hợp lệ.',
      failureStage: 'payload_validation',
    });
  }

  const valid = value.every((row) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) return false;
    return Object.values(row as Record<string, unknown>).every(
      (cell) => typeof cell === 'string' || typeof cell === 'number'
    );
  });

  if (!valid) {
    throw new AuthFlowError({
      status: 400,
      code: 'payload_validation_failed',
      message: 'Dữ liệu danh mục chứa giá trị không hợp lệ.',
      failureStage: 'payload_validation',
    });
  }

  return value as Array<Record<string, string | number>>;
}

function toErrorResponse(error: unknown) {
  if (error instanceof AuthFlowError) {
    return jsonNoStore(
      { success: false, code: error.code, message: error.message },
      { status: error.status }
    );
  }

  const code =
    error && typeof error === 'object' && 'code' in error
      ? String((error as { code?: unknown }).code || 'unknown')
      : 'unknown';
  console.error('[system-metadata-route]', { code });
  return jsonNoStore(
    {
      success: false,
      code: 'system_metadata_operation_failed',
      message: 'Không thể xử lý danh mục hệ thống.',
    },
    { status: 500 }
  );
}

export async function GET(request: Request) {
  try {
    const authContext = await requireSystemSettingsPermission('SYSTEM_SETTINGS_VIEW');
    const supabaseAdmin = createSupabaseAdminClient();
    const lifecycleEnabled = isLifecycleEnabled();
    const includeInactive = lifecycleEnabled && new URL(request.url).searchParams.get('includeInactive') === 'true';
    let query = supabaseAdmin
      .from('system_metadata')
      .select(lifecycleEnabled ? LIFECYCLE_METADATA_SELECT : BASE_METADATA_SELECT)
      .order('id', { ascending: true });
    if (lifecycleEnabled && !includeInactive) query = query.eq('is_active', true);
    const { data, error } = await query;

    if (error) throw error;
    const categories = mergeSystemMetadataCategories(data);
    return jsonNoStore({
      success: true,
      categories,
      lifecycleEnabled,
      canPermanentlyDelete: authContext.employee.role?.toUpperCase() === 'OWNER',
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireSystemSettingsPermission('SYSTEM_SETTINGS_MANAGE');
    const payload = (await request.json().catch(() => null)) as MetadataPayload | null;
    if (!payload) {
      return jsonNoStore(
        { success: false, code: 'payload_validation_failed', message: 'Dữ liệu danh mục không hợp lệ.' },
        { status: 400 }
      );
    }

    const supabaseAdmin = createSupabaseAdminClient();
    const { data, error } = await supabaseAdmin
      .from('system_metadata')
      .insert({ name: requiredName(payload.name), data: [] })
      .select('id, name, data, created_at')
      .single();

    if (error) throw error;
    return jsonNoStore({ success: true, category: data }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const authContext = await requireSystemSettingsPermission('SYSTEM_SETTINGS_MANAGE');
    const payload = (await request.json().catch(() => null)) as MetadataPayload | null;
    const id = numericId(payload?.id);
    if (!payload || !id) {
      return jsonNoStore(
        { success: false, code: 'payload_validation_failed', message: 'Không xác định được danh mục cần cập nhật.' },
        { status: 400 }
      );
    }

    const lifecycleAction = payload.lifecycleAction;
    const supabaseAdmin = createSupabaseAdminClient();
    if (lifecycleAction === 'DEACTIVATE' || lifecycleAction === 'ACTIVATE') {
      requireLifecycleEnabled();
      const activating = lifecycleAction === 'ACTIVATE';
      const { data, error } = await supabaseAdmin
        .from('system_metadata')
        .update({
          is_active: activating,
          deactivated_at: activating ? null : new Date().toISOString(),
          deactivated_by_employee_id: activating ? null : authContext.employee.id,
        })
        .eq('id', id)
        .eq('is_active', !activating)
        .select(LIFECYCLE_METADATA_SELECT)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        return jsonNoStore(
          { success: false, code: 'record_state_conflict', message: 'Danh mục đã ở trạng thái này hoặc không còn tồn tại.' },
          { status: 409 }
        );
      }
      return jsonNoStore({ success: true, category: data });
    }

    let updateQuery = supabaseAdmin
      .from('system_metadata')
      .update({ data: requiredData(payload.data) })
      .eq('id', id);
    if (isLifecycleEnabled()) updateQuery = updateQuery.eq('is_active', true);
    const { data, error } = await updateQuery.select(BASE_METADATA_SELECT).maybeSingle();

    if (error) throw error;
    if (!data) {
      return jsonNoStore(
        { success: false, code: 'system_metadata_not_found', message: 'Không tìm thấy danh mục hệ thống.' },
        { status: 404 }
      );
    }

    return jsonNoStore({ success: true, category: data });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    await requireSystemOwner();
    const id = numericId(new URL(request.url).searchParams.get('id'));
    if (!id) {
      return jsonNoStore(
        { success: false, code: 'payload_validation_failed', message: 'Không xác định được danh mục cần xóa.' },
        { status: 400 }
      );
    }

    const supabaseAdmin = createSupabaseAdminClient();
    let deleteQuery = supabaseAdmin
      .from('system_metadata')
      .delete()
      .eq('id', id);
    if (isLifecycleEnabled()) deleteQuery = deleteQuery.eq('is_active', false);
    const { data, error } = await deleteQuery.select('id').maybeSingle();

    if (error) throw error;
    if (!data) {
      return jsonNoStore(
        {
          success: false,
          code: isLifecycleEnabled() ? 'record_must_be_inactive' : 'system_metadata_not_found',
          message: isLifecycleEnabled() ? 'Cần ngừng hoạt động danh mục trước khi xóa vĩnh viễn.' : 'Không tìm thấy danh mục hệ thống.',
        },
        { status: isLifecycleEnabled() ? 409 : 404 }
      );
    }

    return jsonNoStore({ success: true, deletedId: String(data.id) });
  } catch (error) {
    return toErrorResponse(error);
  }
}
