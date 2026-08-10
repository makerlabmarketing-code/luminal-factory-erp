import { NextResponse } from 'next/server';

import { createSupabaseAdminClient } from '@/utils/supabase/admin';
import { AuthFlowError, hasPermission, requireWorkspaceAccess } from '@/services/server/auth';

const TEMPLATE_SELECT =
  'id, group_type, template_name, subject, html_content, body, script_name, created_at';
const DEFAULT_EMAIL_GROUPS = [
  { code: 'WELCOME', label: '📧 Thư Chào Mừng Thành Viên' },
  { code: 'ORDER_CONFIRM', label: '📦 Xác Nhận Đơn Hàng Mới' },
  { code: 'SHIPPING', label: '🚚 Thông Báo Giao Hàng Xuất Kho' },
  { code: 'ALERT_SYSTEM', label: '⚠️ Cảnh Báo Nghẽn Dây Chuyền' },
];

type TemplateMutationPayload = {
  id?: unknown;
  groupType?: unknown;
  templateName?: unknown;
  subject?: unknown;
  htmlContent?: unknown;
};

function jsonNoStore(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

async function requireEmailTemplatePermission(permissionCode: 'EMAIL_TEMPLATE_VIEW' | 'EMAIL_TEMPLATE_MANAGE') {
  const authContext = await requireWorkspaceAccess('ADMIN_WORKSPACE');
  if (!(await hasPermission(authContext, permissionCode))) {
    throw new AuthFlowError({
      status: 403,
      code: 'permission_forbidden',
      message:
        permissionCode === 'EMAIL_TEMPLATE_VIEW'
          ? 'Bạn không có quyền xem mẫu email.'
          : 'Bạn không có quyền quản lý mẫu email.',
      failureStage: 'permission_check',
    });
  }
  return authContext;
}

function requiredText(payload: TemplateMutationPayload, key: 'groupType' | 'templateName' | 'subject') {
  const value = payload[key];
  if (typeof value !== 'string' || !value.trim()) {
    throw new AuthFlowError({
      status: 400,
      code: 'payload_validation_failed',
      message: 'Vui lòng nhập đầy đủ nhóm, tên kịch bản và tiêu đề email.',
      failureStage: 'payload_validation',
    });
  }
  return value.trim();
}

function optionalHtml(payload: TemplateMutationPayload) {
  return typeof payload.htmlContent === 'string' ? payload.htmlContent.trim() : '';
}

function numericId(value: unknown): number | null {
  const numberValue = typeof value === 'number' ? value : Number(value);
  return Number.isSafeInteger(numberValue) && numberValue > 0 ? numberValue : null;
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
  console.error('[email-template-route]', { code });
  return jsonNoStore(
    { success: false, code: 'email_template_operation_failed', message: 'Không thể xử lý mẫu email.' },
    { status: 500 }
  );
}

export async function GET() {
  try {
    await requireEmailTemplatePermission('EMAIL_TEMPLATE_VIEW');
    const supabaseAdmin = createSupabaseAdminClient();
    const [templateResult, metadataResult] = await Promise.all([
      supabaseAdmin.from('email_templates').select(TEMPLATE_SELECT).order('id', { ascending: false }),
      supabaseAdmin
        .from('system_metadata')
        .select('data')
        .eq('name', 'Danh mục Nhóm Email')
        .maybeSingle(),
    ]);

    if (templateResult.error) throw templateResult.error;
    if (metadataResult.error) throw metadataResult.error;

    const metadataGroups = metadataResult.data?.data;
    const emailGroups = Array.isArray(metadataGroups)
      ? metadataGroups
      : DEFAULT_EMAIL_GROUPS;

    return jsonNoStore({
      success: true,
      templates: templateResult.data || [],
      emailGroups,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireEmailTemplatePermission('EMAIL_TEMPLATE_MANAGE');
    const payload = (await request.json().catch(() => null)) as TemplateMutationPayload | null;
    if (!payload) {
      return jsonNoStore(
        { success: false, code: 'payload_validation_failed', message: 'Dữ liệu mẫu email không hợp lệ.' },
        { status: 400 }
      );
    }

    const supabaseAdmin = createSupabaseAdminClient();
    const { data, error } = await supabaseAdmin
      .from('email_templates')
      .insert({
        group_type: requiredText(payload, 'groupType'),
        template_name: requiredText(payload, 'templateName'),
        subject: requiredText(payload, 'subject'),
        html_content: optionalHtml(payload),
      })
      .select(TEMPLATE_SELECT)
      .single();

    if (error) throw error;
    return jsonNoStore({ success: true, template: data }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    await requireEmailTemplatePermission('EMAIL_TEMPLATE_MANAGE');
    const payload = (await request.json().catch(() => null)) as TemplateMutationPayload | null;
    const id = numericId(payload?.id);
    if (!payload || !id) {
      return jsonNoStore(
        { success: false, code: 'payload_validation_failed', message: 'Không xác định được mẫu email cần cập nhật.' },
        { status: 400 }
      );
    }

    const supabaseAdmin = createSupabaseAdminClient();
    const { data, error } = await supabaseAdmin
      .from('email_templates')
      .update({
        group_type: requiredText(payload, 'groupType'),
        template_name: requiredText(payload, 'templateName'),
        subject: requiredText(payload, 'subject'),
        html_content: optionalHtml(payload),
      })
      .eq('id', id)
      .select(TEMPLATE_SELECT)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return jsonNoStore(
        { success: false, code: 'email_template_not_found', message: 'Không tìm thấy mẫu email.' },
        { status: 404 }
      );
    }

    return jsonNoStore({ success: true, template: data });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    await requireEmailTemplatePermission('EMAIL_TEMPLATE_MANAGE');
    const id = numericId(new URL(request.url).searchParams.get('id'));
    if (!id) {
      return jsonNoStore(
        { success: false, code: 'payload_validation_failed', message: 'Không xác định được mẫu email cần xóa.' },
        { status: 400 }
      );
    }

    const supabaseAdmin = createSupabaseAdminClient();
    const { data, error } = await supabaseAdmin
      .from('email_templates')
      .delete()
      .eq('id', id)
      .select('id')
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return jsonNoStore(
        { success: false, code: 'email_template_not_found', message: 'Không tìm thấy mẫu email.' },
        { status: 404 }
      );
    }

    return jsonNoStore({ success: true, deletedId: String(data.id) });
  } catch (error) {
    return toErrorResponse(error);
  }
}
