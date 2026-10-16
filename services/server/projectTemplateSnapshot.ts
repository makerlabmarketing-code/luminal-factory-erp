import 'server-only';
import { createClient as createSupabaseServerClient } from '@/utils/supabase/server';
import { requireProjectMembershipAction } from '@/services/server/projectMembershipAuthorization';
import { AuthFlowError, hasPermission, requireWorkspaceAccess } from '@/services/server/auth';
import { phaseTemplatesEnabled } from '@/services/server/phaseTemplates';

function invalid(message: string) {
  return new AuthFlowError({ status: 422, code: 'payload_validation_failed', message, failureStage: 'payload_validation' });
}

export async function saveProjectTemplateSnapshot(projectId: number, name: string) {
  if (!Number.isSafeInteger(projectId) || projectId <= 0 || !name.trim() || name.trim().length > 160) throw invalid('Vui lòng nhập tên mẫu hợp lệ.');
  if (!phaseTemplatesEnabled()) throw invalid('Lưu mẫu dự án chưa được kích hoạt.');
  const auth = await requireWorkspaceAccess('ADMIN_WORKSPACE');
  if (!await hasPermission(auth, 'PHASE_TEMPLATE_MANAGE')) {
    throw new AuthFlowError({ status: 403, code: 'permission_forbidden', message: 'Bạn không có quyền lưu mẫu dự án.', failureStage: 'permission_check' });
  }
  await requireProjectMembershipAction(projectId, 'PROJECT_VIEW');
  const db = await createSupabaseServerClient();
  const { data, error } = await db.rpc('save_project_template_atomic', { p_project_id: projectId, p_name: name.trim() });
  if (error) throw invalid('Chưa xác nhận lưu mẫu. Dự án vẫn được giữ nguyên; kiểm tra trước khi thử lại.');
  const result = data as { success?: boolean; versionId?: number; message?: string } | null;
  if (!result?.success) throw invalid(result?.message || 'Không thể lưu mẫu. Dự án vẫn được giữ nguyên.');
  return { success: true, versionId: result.versionId };
}
