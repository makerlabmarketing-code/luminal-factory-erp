import 'server-only';
import { createSupabaseAdminClient } from '@/utils/supabase/admin';
import { AuthFlowError, type AuthFlowErrorCode } from '@/services/server/auth';
import { requirePhaseMutationAccess } from '@/services/server/phaseAuthorization';
import { phaseMemberIds, type PhaseMembersResponse } from '@/lib/phase-members';

function failure(status: number, message: string, code: AuthFlowErrorCode = 'phase_members_failed'): never {
  throw new AuthFlowError({ status, message, code, failureStage: 'unknown' });
}
function ids(project: string, phase: string) {
  const projectId = Number(project); const phaseId = Number(phase);
  if (!Number.isSafeInteger(projectId) || projectId <= 0 || !Number.isSafeInteger(phaseId) || phaseId <= 0) failure(422, 'Mã dự án hoặc giai đoạn không hợp lệ.');
  return { projectId, phaseId };
}
export async function listPhaseMembers(project: string, phase: string): Promise<PhaseMembersResponse> {
  const { projectId, phaseId } = ids(project, phase);
  await requirePhaseMutationAccess({ projectId, phaseId, action: 'PHASE_VIEW' });
  if (process.env.PHASE_MEMBERS_ENABLED !== 'true') return { enabled: false, members: [] };
  const { data, error } = await createSupabaseAdminClient().from('project_phase_members')
    .select('employee_id,employees!project_phase_members_employee_id_fkey(full_name)').eq('phase_id', phaseId).order('employee_id');
  if (error) failure(500, 'Không thể tải người thực hiện. Vui lòng thử lại.');
  return { enabled: true, members: (data || []).map(row => {
    const employee = Array.isArray(row.employees) ? row.employees[0] : row.employees;
    return { employeeId: Number(row.employee_id), fullName: employee?.full_name || `Nhân sự #${row.employee_id}` };
  }) };
}
export async function setPhaseMembers(project: string, phase: string, body: unknown) {
  const { projectId, phaseId } = ids(project, phase);
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => !['employeeIds', 'expectedEmployeeIds'].includes(key))) failure(422, 'Danh sách người thực hiện không hợp lệ.');
  const input = body as Record<string, unknown>;
  let employeeIds: number[]; let expectedEmployeeIds: number[];
  try { employeeIds = phaseMemberIds(input.employeeIds); expectedEmployeeIds = phaseMemberIds(input.expectedEmployeeIds); }
  catch { failure(422, 'Danh sách người thực hiện không hợp lệ.'); }
  const context = await requirePhaseMutationAccess({ projectId, phaseId, action: 'PHASE_ASSIGN' });
  if (process.env.PHASE_MEMBERS_ENABLED !== 'true') failure(409, 'Phân người theo giai đoạn đang chờ kích hoạt.', 'phase_members_not_enabled');
  const { data, error } = await createSupabaseAdminClient().rpc('set_project_phase_members_atomic', {
    p_project_id: projectId, p_phase_id: phaseId, p_employee_ids: employeeIds,
    p_expected_employee_ids: expectedEmployeeIds, p_actor_employee_id: context.actorEmployeeId,
  });
  if (error) {
    const messages: Array<[AuthFlowErrorCode, number, string]> = [
      ['phase_members_stale', 409, 'Phân công đã được thay đổi ở nơi khác. Tải lại trước khi lưu.'],
      ['phase_members_not_project_member', 422, 'Chỉ chọn thành viên đang hoạt động của dự án. Bỏ chọn người đã ngừng tham gia rồi thử lại.'],
      ['phase_members_forbidden', 403, 'Bạn không có quyền phân người cho giai đoạn này.'],
      ['phase_members_project_closed', 409, 'Dự án đã đóng, không thể thay đổi phân công.'],
      ['phase_members_phase_closed', 409, 'Giai đoạn đã đóng, không thể thay đổi phân công.'],
      ['phase_members_phase_mismatch', 404, 'Giai đoạn không thuộc dự án này.'],
      ['phase_members_project_not_found', 404, 'Không tìm thấy dự án.'],
    ];
    const mapped = messages.find(([code]) => error.message?.includes(code));
    if (mapped) failure(mapped[1], mapped[2], mapped[0]);
    failure(500, 'Không thể lưu phân công. Vui lòng thử lại.');
  }
  return { success: true, employeeIds: phaseMemberIds(data?.employeeIds) };
}
