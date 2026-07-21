import 'server-only';

import { createSupabaseAdminClient } from '@/utils/supabase/admin';
import { AuthFlowError } from '@/services/server/auth';
import { getProjectMembershipAuthorization, requireProjectMembershipAction, projectMembershipAuthError } from '@/services/server/projectMembershipAuthorization';
import {
  ProjectMembershipCapabilities,
  ProjectMembershipRoleCode,
  canProjectMembershipPerformAction,
  isProjectMembershipRoleCode,
  projectRoleLabel,
} from '@/services/server/projectMembershipAuthorizationCore';

type Body = Record<string, unknown>;

interface ProjectMemberEmployeeJoin {
  id?: number | string | null;
  full_name?: string | null;
  title?: string | null;
  status?: string | null;
  is_active?: boolean | null;
}

interface ProjectMembershipRow {
  id: number | string;
  project_id: number | string;
  employee_id: number | string;
  role_code: ProjectMembershipRoleCode;
  status: 'ACTIVE' | 'REVOKED';
  granted_at?: string | null;
  revoked_at?: string | null;
  employees?: ProjectMemberEmployeeJoin | ProjectMemberEmployeeJoin[] | null;
}

interface EmployeeCandidateRow {
  id: number | string;
  full_name?: string | null;
  title?: string | null;
  status?: string | null;
  is_active?: boolean | null;
}

function isActiveEmployeeRow(employee: { status?: string | null; is_active?: boolean | null }): boolean {
  const status = String(employee.status || '').trim().toUpperCase();
  return employee.is_active !== false && !['INACTIVE', 'LOCKED', 'DISABLED', 'DELETED'].includes(status);
}

export interface ProjectMemberDTO {
  membershipId: number;
  employeeId: number;
  fullName: string;
  title: string | null;
  roleCode: ProjectMembershipRoleCode;
  roleLabel: string;
  status: 'ACTIVE' | 'REVOKED';
  joinedAt: string | null;
  revokedAt: string | null;
  isAssignable: boolean;
}

export interface ProjectMemberCandidateDTO {
  employeeId: number;
  fullName: string;
  title: string | null;
}

export interface ProjectMembersResponseDTO {
  success: true;
  capabilities: ProjectMembershipCapabilities;
  members: ProjectMemberDTO[];
}

const ADD_KEYS = new Set(['employeeId', 'roleCode']);
const UPDATE_KEYS = new Set(['roleCode']);

function numericId(value: unknown, name: string): number {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw projectMembershipAuthError(422, 'payload_validation_failed', `${name} không hợp lệ.`);
  return id;
}

function assertKnownFields(body: Body, allowed: Set<string>) {
  const unknown = Object.keys(body).filter((key) => !allowed.has(key));
  if (unknown.length) throw projectMembershipAuthError(422, 'payload_validation_failed', 'Dữ liệu thành viên có trường không được hỗ trợ.', { rejected_field_count: unknown.length });
}

function roleFromBody(value: unknown): ProjectMembershipRoleCode {
  if (!isProjectMembershipRoleCode(value)) throw projectMembershipAuthError(422, 'payload_validation_failed', 'Vai trò dự án không hợp lệ.');
  return value;
}

function joinedEmployee(row: ProjectMembershipRow): ProjectMemberEmployeeJoin {
  if (Array.isArray(row.employees)) return row.employees[0] || {};
  return row.employees || {};
}

function mapMember(row: ProjectMembershipRow): ProjectMemberDTO {
  const employee = joinedEmployee(row);
  return {
    membershipId: Number(row.id),
    employeeId: Number(row.employee_id),
    fullName: String(employee.full_name || 'Không rõ nhân sự'),
    title: employee.title ?? null,
    roleCode: row.role_code,
    roleLabel: projectRoleLabel(row.role_code),
    status: row.status,
    joinedAt: row.granted_at ?? null,
    revokedAt: row.revoked_at ?? null,
    isAssignable: row.status === 'ACTIVE' && isActiveEmployeeRow(employee),
  };
}

async function loadProjectMemberRows(projectId: number): Promise<ProjectMembershipRow[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('project_members')
    .select('id, project_id, employee_id, role_code, status, granted_at, revoked_at, employees(id, full_name, title, status, is_active)')
    .eq('project_id', projectId)
    .order('status', { ascending: true })
    .order('granted_at', { ascending: false });
  if (error) throw projectMembershipAuthError(500, 'project_membership_load_failed', 'Không thể tải thành viên dự án.', { supabase_error_code: error.code ?? 'unknown' });
  return (data || []) as ProjectMembershipRow[];
}

export async function listProjectMembers(rawProjectId: string): Promise<ProjectMembersResponseDTO> {
  const projectId = numericId(rawProjectId, 'Mã dự án');
  const authorization = await getProjectMembershipAuthorization(projectId);
  if (!canProjectMembershipPerformAction(authorization.projectRole, 'MEMBER_LIST', authorization.projectStatus)) {
    throw projectMembershipAuthError(403, 'permission_forbidden', 'Bạn không có quyền xem thành viên dự án.');
  }
  const rows = await loadProjectMemberRows(projectId);
  return { success: true, capabilities: authorization.capabilities, members: rows.map(mapMember) };
}

async function assertActiveEmployee(employeeId: number) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.from('employees').select('id, status, is_active, full_name').eq('id', employeeId).maybeSingle();
  if (error) throw projectMembershipAuthError(500, 'project_membership_employee_check_failed', 'Không thể xác minh nhân sự.', { supabase_error_code: error.code ?? 'unknown' });
  if (!data) throw projectMembershipAuthError(404, 'employee_not_linked', 'Không tìm thấy nhân sự.');
  if (!isActiveEmployeeRow(data as EmployeeCandidateRow)) throw projectMembershipAuthError(404, 'employee_inactive', 'Nhân sự không còn hoạt động.');
}

async function assertNoActiveMembership(projectId: number, employeeId: number, exceptMembershipId?: number) {
  const supabase = createSupabaseAdminClient();
  let query = supabase.from('project_members').select('id').eq('project_id', projectId).eq('employee_id', employeeId).eq('status', 'ACTIVE');
  if (exceptMembershipId) query = query.neq('id', exceptMembershipId);
  const { data, error } = await query.limit(1);
  if (error) throw projectMembershipAuthError(500, 'project_membership_duplicate_check_failed', 'Không thể kiểm tra thành viên hiện có.', { supabase_error_code: error.code ?? 'unknown' });
  if (data?.length) throw projectMembershipAuthError(409, 'project_membership_duplicate_active', 'Nhân sự đã có vai trò ACTIVE trong dự án.');
}

async function assertNotLastActiveOwner(projectId: number, membership: Pick<ProjectMembershipRow, 'role_code' | 'status'>) {
  if (membership.status !== 'ACTIVE' || membership.role_code !== 'PROJECT_OWNER') return;
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('project_members')
    .select('id')
    .eq('project_id', projectId)
    .eq('role_code', 'PROJECT_OWNER')
    .eq('status', 'ACTIVE');
  if (error) throw projectMembershipAuthError(500, 'project_membership_owner_check_failed', 'Không thể kiểm tra chủ dự án.', { supabase_error_code: error.code ?? 'unknown' });
  if ((data || []).length <= 1) throw projectMembershipAuthError(409, 'project_membership_last_owner', 'Không thể thu hồi hoặc đổi vai trò chủ dự án cuối cùng.');
}

export async function listProjectMemberCandidates(rawProjectId: string): Promise<{ success: true; candidates: ProjectMemberCandidateDTO[] }> {
  const projectId = numericId(rawProjectId, 'Mã dự án');
  await requireProjectMembershipAction(projectId, 'MEMBER_ADD');
  const supabase = createSupabaseAdminClient();
  const [membersResult, employeesResult] = await Promise.all([
    supabase.from('project_members').select('employee_id').eq('project_id', projectId).eq('status', 'ACTIVE'),
    supabase.from('employees').select('id, full_name, title, status, is_active').order('full_name', { ascending: true }),
  ]);
  if (membersResult.error) throw projectMembershipAuthError(500, 'project_membership_load_failed', 'Không thể tải thành viên dự án.', { supabase_error_code: membersResult.error.code ?? 'unknown' });
  if (employeesResult.error) throw projectMembershipAuthError(500, 'project_membership_employee_check_failed', 'Không thể tải danh sách nhân sự.', { supabase_error_code: employeesResult.error.code ?? 'unknown' });
  const activeMemberEmployeeIds = new Set((membersResult.data || []).map((row) => Number(row.employee_id)));
  const candidates = ((employeesResult.data || []) as EmployeeCandidateRow[])
    .filter((employee) => isActiveEmployeeRow(employee))
    .filter((employee) => !activeMemberEmployeeIds.has(Number(employee.id)))
    .map((employee) => ({
      employeeId: Number(employee.id),
      fullName: employee.full_name || `Nhân sự #${employee.id}`,
      title: employee.title ?? null,
    }));
  return { success: true, candidates };
}

export async function addProjectMember(rawProjectId: string, body: Body): Promise<{ success: true; member: ProjectMemberDTO }> {
  assertKnownFields(body, ADD_KEYS);
  const projectId = numericId(rawProjectId, 'Mã dự án');
  const employeeId = numericId(body.employeeId, 'Mã nhân sự');
  const roleCode = roleFromBody(body.roleCode);
  const auth = await requireProjectMembershipAction(projectId, 'MEMBER_ADD');
  await assertActiveEmployee(employeeId);
  await assertNoActiveMembership(projectId, employeeId);
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.from('project_members').insert([{ project_id: projectId, employee_id: employeeId, role_code: roleCode, status: 'ACTIVE', granted_by_employee_id: auth.actorEmployeeId }]).select('id').single();
  if (error) throw projectMembershipAuthError(error.code === '23505' ? 409 : 500, error.code === '23505' ? 'project_membership_duplicate_active' : 'project_membership_create_failed', error.code === '23505' ? 'Nhân sự đã có vai trò ACTIVE trong dự án.' : 'Không thể thêm thành viên dự án.', { supabase_error_code: error.code ?? 'unknown' });
  const rows = await loadProjectMemberRows(projectId);
  const member = rows.map(mapMember).find((item) => item.membershipId === Number(data.id));
  if (!member) throw projectMembershipAuthError(500, 'project_membership_create_failed', 'Không thể tải thành viên vừa tạo.');
  return { success: true, member };
}

async function loadMembership(projectId: number, membershipId: number): Promise<ProjectMembershipRow> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.from('project_members').select('id, project_id, employee_id, role_code, status').eq('id', membershipId).maybeSingle();
  if (error) throw projectMembershipAuthError(500, 'project_membership_load_failed', 'Không thể tải thành viên dự án.', { supabase_error_code: error.code ?? 'unknown' });
  const membership = data as ProjectMembershipRow | null;
  if (!membership || Number(membership.project_id) !== projectId) throw projectMembershipAuthError(404, 'project_membership_not_found', 'Không tìm thấy thành viên trong dự án.');
  return membership;
}

export async function updateProjectMember(rawProjectId: string, rawMembershipId: string, body: Body): Promise<{ success: true; member: ProjectMemberDTO }> {
  assertKnownFields(body, UPDATE_KEYS);
  const projectId = numericId(rawProjectId, 'Mã dự án');
  const membershipId = numericId(rawMembershipId, 'Mã thành viên');
  const roleCode = roleFromBody(body.roleCode);
  const auth = await requireProjectMembershipAction(projectId, 'MEMBER_ROLE_CHANGE');
  const membership = await loadMembership(projectId, membershipId);
  if (membership.status !== 'ACTIVE') throw projectMembershipAuthError(409, 'project_membership_revoked', 'Thành viên đã bị thu hồi.');
  if (membership.role_code === roleCode) {
    const rows = await loadProjectMemberRows(projectId);
    const current = rows.map(mapMember).find((item) => item.membershipId === membershipId);
    if (current) return { success: true, member: current };
  }
  await assertNotLastActiveOwner(projectId, membership);
  await assertNoActiveMembership(projectId, Number(membership.employee_id), membershipId);
  const supabase = createSupabaseAdminClient();
  const revokedAt = new Date().toISOString();
  const revokeResult = await supabase
    .from('project_members')
    .update({ status: 'REVOKED', revoked_at: revokedAt, revoked_by_employee_id: auth.actorEmployeeId })
    .eq('id', membershipId)
    .eq('project_id', projectId)
    .eq('status', 'ACTIVE');
  if (revokeResult.error) throw projectMembershipAuthError(500, 'project_membership_update_failed', 'Không thể đổi vai trò thành viên.', { supabase_error_code: revokeResult.error.code ?? 'unknown' });
  const insertResult = await supabase
    .from('project_members')
    .insert([{ project_id: projectId, employee_id: Number(membership.employee_id), role_code: roleCode, status: 'ACTIVE', granted_by_employee_id: auth.actorEmployeeId }])
    .select('id')
    .single();
  if (insertResult.error) throw projectMembershipAuthError(insertResult.error.code === '23505' ? 409 : 500, insertResult.error.code === '23505' ? 'project_membership_duplicate_active' : 'project_membership_update_failed', insertResult.error.code === '23505' ? 'Nhân sự đã có vai trò ACTIVE trong dự án.' : 'Không thể tạo vai trò mới cho thành viên.', { supabase_error_code: insertResult.error.code ?? 'unknown' });
  const rows = await loadProjectMemberRows(projectId);
  const member = rows.map(mapMember).find((item) => item.membershipId === Number(insertResult.data.id));
  if (!member) throw projectMembershipAuthError(500, 'project_membership_update_failed', 'Không thể tải thành viên vừa cập nhật.');
  return { success: true, member };
}

export async function revokeProjectMember(rawProjectId: string, rawMembershipId: string): Promise<{ success: true; revoked: true }> {
  const projectId = numericId(rawProjectId, 'Mã dự án');
  const membershipId = numericId(rawMembershipId, 'Mã thành viên');
  const auth = await requireProjectMembershipAction(projectId, 'MEMBER_REVOKE');
  const membership = await loadMembership(projectId, membershipId);
  if (membership.status === 'REVOKED') throw projectMembershipAuthError(409, 'project_membership_already_revoked', 'Thành viên đã được thu hồi trước đó.');
  await assertNotLastActiveOwner(projectId, membership);
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from('project_members').update({ status: 'REVOKED', revoked_at: new Date().toISOString(), revoked_by_employee_id: auth.actorEmployeeId }).eq('id', membershipId).eq('project_id', projectId).eq('status', 'ACTIVE');
  if (error) throw projectMembershipAuthError(500, 'project_membership_revoke_failed', 'Không thể thu hồi thành viên dự án.', { supabase_error_code: error.code ?? 'unknown' });
  return { success: true, revoked: true };
}

export function projectMembershipErrorResponse(error: unknown) {
  if (error instanceof AuthFlowError) return { body: { success: false, message: error.message, code: error.code, failure_stage: error.failureStage, supabase_error_code: error.safeDetails?.supabase_error_code ?? null }, status: error.status };
  return { body: { success: false, message: 'Không thể xử lý thành viên dự án.', code: 'project_membership_failed', failure_stage: 'unknown' }, status: 500 };
}
