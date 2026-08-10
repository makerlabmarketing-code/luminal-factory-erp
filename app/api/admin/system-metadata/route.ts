import { NextResponse } from 'next/server';

import { DEFAULT_SYSTEM_METADATA_CATEGORIES } from '@/lib/system-metadata-defaults';
import { AuthFlowError, hasPermission, requireWorkspaceAccess } from '@/services/server/auth';
import { createSupabaseAdminClient } from '@/utils/supabase/admin';

type MetadataPayload = {
  id?: unknown;
  name?: unknown;
  data?: unknown;
};

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

export async function GET() {
  try {
    await requireSystemSettingsPermission('SYSTEM_SETTINGS_VIEW');
    const supabaseAdmin = createSupabaseAdminClient();
    const { data, error } = await supabaseAdmin
      .from('system_metadata')
      .select('id, name, data, created_at')
      .order('id', { ascending: true });

    if (error) throw error;
    const categories = data && data.length > 0 ? data : DEFAULT_SYSTEM_METADATA_CATEGORIES;
    return jsonNoStore({ success: true, categories });
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
    await requireSystemSettingsPermission('SYSTEM_SETTINGS_MANAGE');
    const payload = (await request.json().catch(() => null)) as MetadataPayload | null;
    const id = numericId(payload?.id);
    if (!payload || !id) {
      return jsonNoStore(
        { success: false, code: 'payload_validation_failed', message: 'Không xác định được danh mục cần cập nhật.' },
        { status: 400 }
      );
    }

    const supabaseAdmin = createSupabaseAdminClient();
    const { data, error } = await supabaseAdmin
      .from('system_metadata')
      .update({ data: requiredData(payload.data) })
      .eq('id', id)
      .select('id, name, data, created_at')
      .maybeSingle();

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
    await requireSystemSettingsPermission('SYSTEM_SETTINGS_MANAGE');
    const id = numericId(new URL(request.url).searchParams.get('id'));
    if (!id) {
      return jsonNoStore(
        { success: false, code: 'payload_validation_failed', message: 'Không xác định được danh mục cần xóa.' },
        { status: 400 }
      );
    }

    const supabaseAdmin = createSupabaseAdminClient();
    const { data, error } = await supabaseAdmin
      .from('system_metadata')
      .delete()
      .eq('id', id)
      .select('id')
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return jsonNoStore(
        { success: false, code: 'system_metadata_not_found', message: 'Không tìm thấy danh mục hệ thống.' },
        { status: 404 }
      );
    }

    return jsonNoStore({ success: true, deletedId: String(data.id) });
  } catch (error) {
    return toErrorResponse(error);
  }
}
