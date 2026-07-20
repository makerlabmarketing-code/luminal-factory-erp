import 'server-only';

import { createSupabaseAdminClient } from '@/utils/supabase/admin';
import { AuthContext, AuthFlowError, hasPermission, hasWorkspaceAccess, requireAuthenticatedEmployee } from '@/services/server/auth';
import {
  ProjectMembershipAction,
  ProjectMembershipCapabilities,
  ProjectMembershipRoleCode,
  canProjectMembershipPerformAction,
  capabilitiesForProjectRole,
  resolveSingleActiveProjectMembershipRole,
} from '@/services/server/projectMembershipAuthorizationCore';

export interface ProjectMembershipAuthorizationContext {
  authContext: AuthContext;
  actorEmployeeId: number;
  projectId: number;
  projectStatus: string | null;
  projectRole: ProjectMembershipRoleCode | 'GLOBAL_PROJECT_MANAGE' | null;
  capabilities: ProjectMembershipCapabilities;
}

export function projectMembershipAuthError(status: number, code: string, message: string, safeDetails?: Record<string, boolean | number | string | null>) {
  return new AuthFlowError({ status, code: code as AuthFlowError['code'], message, failureStage: status === 422 ? 'payload_validation' : status === 401 ? 'auth_get_user' : status === 403 ? 'permission_check' : 'unknown', safeDetails });
}

function actorEmployeeId(authContext: AuthContext): number {
  const employeeId = Number(authContext.employee.id);
  if (!Number.isInteger(employeeId) || employeeId <= 0) {
    throw projectMembershipAuthError(403, 'permission_forbidden', 'Không thể xác định nhân sự thao tác.');
  }
  return employeeId;
}

async function resolveAuthContext(): Promise<AuthContext> {
  try {
    return await requireAuthenticatedEmployee();
  } catch (error) {
    if (error instanceof AuthFlowError) {
      throw projectMembershipAuthError(error.status === 401 ? 401 : error.status === 500 ? 500 : 403, error.status === 401 ? 'session_not_verified' : 'permission_forbidden', error.status === 401 ? 'Phiên đăng nhập chưa được xác nhận.' : 'Bạn không có quyền thao tác dự án.', error.safeDetails);
    }
    throw error;
  }
}

async function loadProjectStatus(projectId: number): Promise<string | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.from('projects').select('id, status').eq('id', projectId).maybeSingle();
  if (error) throw projectMembershipAuthError(500, 'project_membership_authorization_failed', 'Không thể xác minh dự án.', { supabase_error_code: error.code ?? 'unknown' });
  if (!data) throw projectMembershipAuthError(404, 'project_not_found', 'Không tìm thấy dự án.');
  return (data as { status?: string | null }).status ?? null;
}

async function loadProjectRole(projectId: number, employeeId: number): Promise<ProjectMembershipRoleCode | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.from('project_members').select('role_code, status').eq('project_id', projectId).eq('employee_id', employeeId).eq('status', 'ACTIVE');
  if (error) throw projectMembershipAuthError(500, 'project_membership_authorization_failed', 'Không thể xác minh vai trò dự án.', { supabase_error_code: error.code ?? 'unknown' });
  return resolveSingleActiveProjectMembershipRole((data || []) as Array<{ role_code?: string | null; status?: string | null }>);
}

async function hasGlobalProjectManage(authContext: AuthContext): Promise<boolean> {
  const [adminWorkspace, projectManage] = await Promise.all([
    hasWorkspaceAccess(authContext, 'ADMIN_WORKSPACE'),
    hasPermission(authContext, 'PROJECT_MANAGE'),
  ]);
  return adminWorkspace && projectManage;
}

export async function getProjectMembershipAuthorization(projectId: number): Promise<ProjectMembershipAuthorizationContext> {
  const authContext = await resolveAuthContext();
  const employeeId = actorEmployeeId(authContext);
  const [projectStatus, globalManage, role] = await Promise.all([
    loadProjectStatus(projectId),
    hasGlobalProjectManage(authContext),
    loadProjectRole(projectId, employeeId),
  ]);
  const projectRole = globalManage ? 'GLOBAL_PROJECT_MANAGE' : role;
  return {
    authContext,
    actorEmployeeId: employeeId,
    projectId,
    projectStatus,
    projectRole,
    capabilities: capabilitiesForProjectRole(projectRole, projectStatus),
  };
}

export async function requireProjectMembershipAction(projectId: number, action: ProjectMembershipAction): Promise<ProjectMembershipAuthorizationContext> {
  const context = await getProjectMembershipAuthorization(projectId);
  if (!canProjectMembershipPerformAction(context.projectRole, action, context.projectStatus)) {
    throw projectMembershipAuthError(403, 'permission_forbidden', 'Bạn không có quyền thực hiện thao tác này.');
  }
  return context;
}
