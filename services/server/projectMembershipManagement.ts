import 'server-only';

import { randomUUID } from 'node:crypto';
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

const ADD_KEYS = new Set(['employeeId', 'roleCode', 'reason']);
const UPDATE_KEYS = new Set(['roleCode', 'reason']);
const REVOKE_KEYS = new Set(['reason']);

export const PROJECT_MEMBERSHIP_ATOMIC_MUTATIONS_FLAG = 'PROJECT_MEMBERSHIP_ATOMIC_MUTATIONS_ENABLED';

export function isProjectMembershipAtomicMutationEnabled(): boolean {
  return process.env[PROJECT_MEMBERSHIP_ATOMIC_MUTATIONS_FLAG] === 'true';
}

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

function reasonFromBody(value: unknown): string {
  const reason = typeof value === 'string' ? value.trim() : '';
  if (reason.length < 10 || reason.length > 500) {
    throw projectMembershipAuthError(
      422,
      'payload_validation_failed',
      'Lý do phải có từ 10 đến 500 ký tự.'
    );
  }
  return reason;
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

type AtomicMembershipOperation = 'ADD' | 'CHANGE_ROLE' | 'REVOKE';

interface AtomicMembershipResult {
  success?: unknown;
  membership_id?: unknown;
}

function requireAtomicMutationGate() {
  if (!isProjectMembershipAtomicMutationEnabled()) {
    throw projectMembershipAuthError(
      409,
      'project_membership_atomic_mutation_required',
      'Chức năng cập nhật thành viên đang chờ kích hoạt.'
    );
  }
}

function mapAtomicMutationFailure(error: { code?: string; message?: string } | null, correlationId: string): never {
  const databaseMessage = String(error?.message || '');
  if (databaseMessage.includes('project_membership_duplicate_active')) {
    throw projectMembershipAuthError(409, 'project_membership_duplicate_active', 'Nhân sự đã có vai trò đang hoạt động trong dự án.');
  }
  if (databaseMessage.includes('project_membership_last_owner')) {
    throw projectMembershipAuthError(409, 'project_membership_last_owner', 'Không thể thu hồi hoặc đổi vai trò Chủ dự án cuối cùng.');
  }
  if (databaseMessage.includes('project_membership_active_tasks')) {
    throw projectMembershipAuthError(409, 'project_membership_active_tasks', 'Nhân sự còn công việc đang hoạt động. Hãy chuyển giao hoặc hoàn tất công việc trước.');
  }
  if (databaseMessage.includes('project_membership_not_found')) {
    throw projectMembershipAuthError(404, 'project_membership_not_found', 'Không tìm thấy thành viên đang hoạt động trong dự án.');
  }
  if (databaseMessage.includes('project_membership_employee_inactive')) {
    throw projectMembershipAuthError(409, 'employee_inactive', 'Nhân sự không còn hoạt động.');
  }
  if (databaseMessage.includes('project_membership_project_cancelled')) {
    throw projectMembershipAuthError(409, 'project_cancelled', 'Dự án đã hủy nên không thể cập nhật thành viên.');
  }
  if (databaseMessage.includes('project_membership_permission_forbidden')) {
    throw projectMembershipAuthError(403, 'project_forbidden', 'Bạn không có quyền cập nhật thành viên dự án.');
  }
  throw projectMembershipAuthError(
    500,
    'project_membership_atomic_mutation_failed',
    'Không thể cập nhật thành viên dự án.',
    { supabase_error_code: error?.code ?? 'unknown', correlation_id: correlationId }
  );
}

async function mutateProjectMembership(input: {
  operation: AtomicMembershipOperation;
  projectId: number;
  actorEmployeeId: number;
  reason: string;
  correlationId: string;
  membershipId?: number;
  employeeId?: number;
  roleCode?: ProjectMembershipRoleCode;
}): Promise<number> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc('mutate_project_membership', {
    p_operation: input.operation,
    p_project_id: input.projectId,
    p_membership_id: input.membershipId ?? null,
    p_employee_id: input.employeeId ?? null,
    p_role_code: input.roleCode ?? null,
    p_actor_employee_id: input.actorEmployeeId,
    p_reason: input.reason,
    p_correlation_id: input.correlationId,
  });
  if (error) mapAtomicMutationFailure(error, input.correlationId);
  const result = data as AtomicMembershipResult | null;
  const membershipId = Number(result?.membership_id);
  if (result?.success !== true || !Number.isInteger(membershipId) || membershipId <= 0) {
    throw projectMembershipAuthError(500, 'project_membership_atomic_mutation_failed', 'Không thể xác nhận thay đổi thành viên dự án.');
  }
  return membershipId;
}

export async function addProjectMember(rawProjectId: string, body: Body): Promise<{ success: true; member: ProjectMemberDTO; correlationId: string }> {
  assertKnownFields(body, ADD_KEYS);
  const projectId = numericId(rawProjectId, 'Mã dự án');
  const employeeId = numericId(body.employeeId, 'Mã nhân sự');
  const roleCode = roleFromBody(body.roleCode);
  const reason = reasonFromBody(body.reason);
  const auth = await requireProjectMembershipAction(projectId, 'MEMBER_ADD');
  requireAtomicMutationGate();
  const correlationId = randomUUID();
  const membershipId = await mutateProjectMembership({ operation: 'ADD', projectId, employeeId, roleCode, actorEmployeeId: auth.actorEmployeeId, reason, correlationId });
  const rows = await loadProjectMemberRows(projectId);
  const member = rows.map(mapMember).find((item) => item.membershipId === membershipId);
  if (!member) throw projectMembershipAuthError(500, 'project_membership_create_failed', 'Không thể tải thành viên vừa tạo.');
  return { success: true, member, correlationId };
}

export async function updateProjectMember(rawProjectId: string, rawMembershipId: string, body: Body): Promise<{ success: true; member: ProjectMemberDTO; correlationId: string }> {
  assertKnownFields(body, UPDATE_KEYS);
  const projectId = numericId(rawProjectId, 'Mã dự án');
  const membershipId = numericId(rawMembershipId, 'Mã thành viên');
  const roleCode = roleFromBody(body.roleCode);
  const reason = reasonFromBody(body.reason);
  const auth = await requireProjectMembershipAction(projectId, 'MEMBER_ROLE_CHANGE');
  requireAtomicMutationGate();
  const correlationId = randomUUID();
  const nextMembershipId = await mutateProjectMembership({ operation: 'CHANGE_ROLE', projectId, membershipId, roleCode, actorEmployeeId: auth.actorEmployeeId, reason, correlationId });
  const rows = await loadProjectMemberRows(projectId);
  const member = rows.map(mapMember).find((item) => item.membershipId === nextMembershipId);
  if (!member) throw projectMembershipAuthError(500, 'project_membership_update_failed', 'Không thể tải thành viên vừa cập nhật.');
  return { success: true, member, correlationId };
}

export async function revokeProjectMember(rawProjectId: string, rawMembershipId: string, body: Body): Promise<{ success: true; revoked: true; correlationId: string }> {
  assertKnownFields(body, REVOKE_KEYS);
  const projectId = numericId(rawProjectId, 'Mã dự án');
  const membershipId = numericId(rawMembershipId, 'Mã thành viên');
  const reason = reasonFromBody(body.reason);
  const auth = await requireProjectMembershipAction(projectId, 'MEMBER_REVOKE');
  requireAtomicMutationGate();
  const correlationId = randomUUID();
  await mutateProjectMembership({ operation: 'REVOKE', projectId, membershipId, actorEmployeeId: auth.actorEmployeeId, reason, correlationId });
  return { success: true, revoked: true, correlationId };
}

export function projectMembershipErrorResponse(error: unknown) {
  if (error instanceof AuthFlowError) return { body: { success: false, message: error.message, code: error.code, failure_stage: error.failureStage, correlationId: error.safeDetails?.correlation_id ?? null }, status: error.status };
  return { body: { success: false, message: 'Không thể xử lý thành viên dự án.', code: 'project_membership_failed', failure_stage: 'unknown' }, status: 500 };
}
