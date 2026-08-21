import 'server-only';

import { createSupabaseAdminClient } from '@/utils/supabase/admin';
import { createClient as createSupabaseServerClient } from '@/utils/supabase/server';
import {
  AuthFlowError,
  hasPermission,
  requireWorkspaceAccess,
} from '@/services/server/auth';

export interface PhaseTemplateOption {
  templateId: number;
  versionId: number;
  versionNumber: number;
  name: string;
  description: string | null;
  stageCount: number;
}

export function phaseTemplatesEnabled(): boolean {
  return process.env.PHASE_TEMPLATES_ENABLED === 'true';
}

async function requirePhaseTemplateManage() {
  const authContext = await requireWorkspaceAccess('ADMIN_WORKSPACE');
  if (!await hasPermission(authContext, 'PHASE_TEMPLATE_MANAGE')) {
    throw new AuthFlowError({
      status: 403,
      code: 'permission_forbidden',
      message: 'Bạn không có quyền quản lý mẫu giai đoạn.',
      failureStage: 'permission_check',
      safeDetails: { permission_check_result: 'denied' },
    });
  }
  return authContext;
}

export async function mutatePhaseTemplate(payload: Record<string, unknown>) {
  if (!phaseTemplatesEnabled()) {
    throw new AuthFlowError({
      status: 422,
      code: 'payload_validation_failed',
      message: 'Quản lý mẫu giai đoạn đang chờ kích hoạt.',
      failureStage: 'payload_validation',
    });
  }
  await requirePhaseTemplateManage();

  const rejectedActorFields = [
    'actorEmployeeId',
    'actor_employee_id',
    'createdByEmployeeId',
    'updatedByEmployeeId',
    'publishedByEmployeeId',
  ];
  if (rejectedActorFields.some((field) => Object.prototype.hasOwnProperty.call(payload, field))) {
    throw new AuthFlowError({
      status: 422,
      code: 'payload_validation_failed',
      message: 'Dữ liệu người thao tác không hợp lệ.',
      failureStage: 'payload_validation',
    });
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc('manage_phase_template_atomic', { p_payload: payload });
  if (error) {
    throw new AuthFlowError({
      status: 500,
      code: 'admin_verification_failed',
      message: 'Không thể cập nhật mẫu giai đoạn.',
      failureStage: 'persistence',
      safeDetails: { supabase_error_code: error.code ?? 'unknown' },
    });
  }

  const result = data as { success?: unknown; code?: unknown; message?: unknown } | null;
  if (!result?.success) {
    const code = String(result?.code || 'phase_template_mutation_failed');
    throw new AuthFlowError({
      status: code === 'permission_forbidden' ? 403 : code === 'session_not_verified' ? 401 : 422,
      code: code === 'permission_forbidden' ? 'permission_forbidden' : code === 'session_not_verified' ? 'session_not_verified' : 'payload_validation_failed',
      message: typeof result?.message === 'string' ? result.message : 'Không thể cập nhật mẫu giai đoạn.',
      failureStage: code === 'permission_forbidden' ? 'permission_check' : code === 'session_not_verified' ? 'auth_get_user' : 'payload_validation',
    });
  }

  return result;
}

export async function getPublishedPhaseTemplateOptions(): Promise<PhaseTemplateOption[]> {
  if (!phaseTemplatesEnabled()) return [];

  const authContext = await requireWorkspaceAccess('ADMIN_WORKSPACE');
  if (!await hasPermission(authContext, 'PROJECT_MANAGE')) {
    throw new AuthFlowError({
      status: 403,
      code: 'permission_forbidden',
      message: 'Bạn không có quyền tạo dự án.',
      failureStage: 'permission_check',
      safeDetails: { permission_check_result: 'denied' },
    });
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('phase_templates')
    .select('id, name, description, current_version_id, phase_template_versions!phase_templates_current_version_id_fkey(id, version_number, status, phase_template_stages(count))')
    .eq('project_type', 'GENERAL')
    .eq('status', 'ACTIVE')
    .eq('phase_template_versions.status', 'PUBLISHED')
    .order('name', { ascending: true });

  if (error) {
    throw new AuthFlowError({
      status: 503,
      code: 'admin_verification_failed',
      message: 'Không thể tải mẫu giai đoạn.',
      failureStage: 'unknown',
      safeDetails: { supabase_error_code: error.code ?? 'unknown' },
    });
  }

  return (data || []).flatMap((template) => {
    const relation = template.phase_template_versions;
    const version = Array.isArray(relation) ? relation[0] : relation;
    if (!version || Number(version.id) !== Number(template.current_version_id)) return [];
    const stages = version.phase_template_stages;
    const stageCount = Array.isArray(stages) ? Number(stages[0]?.count || 0) : 0;
    return [{
      templateId: Number(template.id),
      versionId: Number(version.id),
      versionNumber: Number(version.version_number),
      name: String(template.name || ''),
      description: template.description ?? null,
      stageCount,
    }];
  });
}
