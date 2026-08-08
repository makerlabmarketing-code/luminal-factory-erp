import 'server-only';

import { createSupabaseAdminClient } from '@/utils/supabase/admin';
import { getProjectMembershipAuthorization, projectMembershipAuthError } from '@/services/server/projectMembershipAuthorization';
import {
  canProjectMembershipPerformAction,
  projectRoleLabel,
  type ProjectMembershipCapabilities,
  type ProjectMembershipRoleCode,
} from '@/services/server/projectMembershipAuthorizationCore';

interface EmployeeJoin {
  id?: number | string | null;
  full_name?: string | null;
  title?: string | null;
  status?: string | null;
  is_active?: boolean | null;
}

interface MembershipRow {
  id: number | string;
  employee_id: number | string;
  role_code: ProjectMembershipRoleCode;
  status: 'ACTIVE' | 'REVOKED';
  granted_at?: string | null;
  revoked_at?: string | null;
  employees?: EmployeeJoin | EmployeeJoin[] | null;
}

export interface ProjectMembershipReadMember {
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

export interface ProjectMembershipReadSummary {
  projectId: number;
  projectCode: string;
  activeMemberCount: number;
  ownerCount: number;
  managerCount: number;
  creativeLeadCount: number;
  contributorCount: number;
  hasActiveOwner: boolean;
  capabilities: ProjectMembershipCapabilities;
  members: ProjectMembershipReadMember[];
}

function numericProjectId(value: string): number {
  const projectId = Number(value);
  if (!Number.isInteger(projectId) || projectId <= 0) {
    throw projectMembershipAuthError(422, 'payload_validation_failed', 'Mã dự án không hợp lệ.');
  }
  return projectId;
}

function joinedEmployee(row: MembershipRow): EmployeeJoin {
  if (Array.isArray(row.employees)) return row.employees[0] || {};
  return row.employees || {};
}

function isActiveEmployee(employee: EmployeeJoin): boolean {
  const status = String(employee.status || '').trim().toUpperCase();
  return employee.is_active !== false && !['INACTIVE', 'LOCKED', 'DISABLED', 'DELETED'].includes(status);
}

function mapMember(row: MembershipRow): ProjectMembershipReadMember {
  const employee = joinedEmployee(row);
  return {
    membershipId: Number(row.id),
    employeeId: Number(row.employee_id),
    fullName: String(employee.full_name || `Nhân sự #${row.employee_id}`),
    title: employee.title ?? null,
    roleCode: row.role_code,
    roleLabel: projectRoleLabel(row.role_code),
    status: row.status,
    joinedAt: row.granted_at ?? null,
    revokedAt: row.revoked_at ?? null,
    isAssignable: row.status === 'ACTIVE' && isActiveEmployee(employee),
  };
}

const ROLE_ORDER: Record<ProjectMembershipRoleCode, number> = {
  PROJECT_OWNER: 0,
  PROJECT_MANAGER: 1,
  CREATIVE_LEAD: 2,
  CONTRIBUTOR: 3,
};

function sortMembers(left: ProjectMembershipReadMember, right: ProjectMembershipReadMember): number {
  if (left.status !== right.status) return left.status === 'ACTIVE' ? -1 : 1;
  const roleOrder = ROLE_ORDER[left.roleCode] - ROLE_ORDER[right.roleCode];
  if (roleOrder !== 0) return roleOrder;
  return left.fullName.localeCompare(right.fullName, 'vi');
}

export async function getProjectMembershipReadModel(rawProjectId: string): Promise<ProjectMembershipReadSummary> {
  const projectId = numericProjectId(rawProjectId);
  const authorization = await getProjectMembershipAuthorization(projectId);
  if (!canProjectMembershipPerformAction(authorization.projectRole, 'MEMBER_LIST', authorization.projectStatus)) {
    throw projectMembershipAuthError(403, 'permission_forbidden', 'Bạn không có quyền xem thành viên dự án.');
  }

  const supabase = createSupabaseAdminClient();
  const [projectResult, memberResult] = await Promise.all([
    supabase.from('projects').select('id, project_code').eq('id', projectId).maybeSingle(),
    supabase
      .from('project_members')
      .select('id, employee_id, role_code, status, granted_at, revoked_at, employees(id, full_name, title, status, is_active)')
      .eq('project_id', projectId),
  ]);

  if (projectResult.error) {
    throw projectMembershipAuthError(500, 'project_membership_load_failed', 'Không thể tải thông tin dự án.', { supabase_error_code: projectResult.error.code ?? 'unknown' });
  }
  if (!projectResult.data) {
    throw projectMembershipAuthError(404, 'project_not_found', 'Không tìm thấy dự án.');
  }
  if (memberResult.error) {
    throw projectMembershipAuthError(500, 'project_membership_load_failed', 'Không thể tải thành viên dự án.', { supabase_error_code: memberResult.error.code ?? 'unknown' });
  }

  const members = ((memberResult.data || []) as MembershipRow[]).map(mapMember).sort(sortMembers);
  const active = members.filter((member) => member.status === 'ACTIVE');
  const countRole = (roleCode: ProjectMembershipRoleCode) => active.filter((member) => member.roleCode === roleCode).length;
  const ownerCount = countRole('PROJECT_OWNER');

  return {
    projectId,
    projectCode: String(projectResult.data.project_code || ''),
    activeMemberCount: active.length,
    ownerCount,
    managerCount: countRole('PROJECT_MANAGER'),
    creativeLeadCount: countRole('CREATIVE_LEAD'),
    contributorCount: countRole('CONTRIBUTOR'),
    hasActiveOwner: ownerCount > 0,
    capabilities: authorization.capabilities,
    members,
  };
}
