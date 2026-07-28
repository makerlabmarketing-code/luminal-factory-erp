import 'server-only';

import { createSupabaseAdminClient } from '@/utils/supabase/admin';
import { AuthContext, AuthFlowError, checkPermissionAccess, checkWorkspaceAccess, hasAdminAccess, requireAuthenticatedEmployee } from '@/services/server/auth';
import {
  ProjectMembershipAction,
  ProjectMembershipCapabilities,
  ProjectMembershipRoleCode,
  canProjectMembershipPerformAction,
  capabilitiesForProjectRole,
  GLOBAL_PROJECT_VIEW_CAPABILITIES,
  ProjectMembershipAuthorizationModelError,
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
      if (error.code === 'employee_not_linked') {
        throw projectMembershipAuthError(403, 'employee_not_connected', 'Tài khoản chưa được liên kết với nhân sự.', error.safeDetails);
      }
      if (error.code === 'employee_inactive') {
        throw projectMembershipAuthError(403, 'employee_inactive', 'Tài khoản nhân sự đang ngừng hoạt động.', error.safeDetails);
      }
      if (error.status === 401) {
        throw projectMembershipAuthError(401, 'session_not_verified', 'Phiên đăng nhập chưa được xác nhận.', error.safeDetails);
      }
      if (error.status >= 500) {
        throw projectMembershipAuthError(500, 'project_authorization_failed', 'Chưa thể xác minh quyền dự án. Vui lòng thử lại.', error.safeDetails);
      }
      throw projectMembershipAuthError(403, 'project_forbidden', 'Bạn không có quyền truy cập dự án.', error.safeDetails);
    }
    throw error;
  }
}

async function loadProjectStatus(projectId: number): Promise<string | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.from('projects').select('id, status').eq('id', projectId).maybeSingle();
  if (error) throw projectMembershipAuthError(500, 'project_authorization_failed', 'Chưa thể xác minh dự án. Vui lòng thử lại.', { supabase_error_code: error.code ?? 'unknown' });
  if (!data) throw projectMembershipAuthError(404, 'project_not_found', 'Không tìm thấy dự án.');
  return (data as { status?: string | null }).status ?? null;
}

async function loadProjectRole(projectId: number, employeeId: number): Promise<ProjectMembershipRoleCode | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.from('project_members').select('role_code, status').eq('project_id', projectId).eq('employee_id', employeeId).eq('status', 'ACTIVE');
  if (error) throw projectMembershipAuthError(500, 'membership_lookup_failed', 'Chưa thể xác minh thành viên dự án. Vui lòng thử lại.', { supabase_error_code: error.code ?? 'unknown' });
  try {
    return resolveSingleActiveProjectMembershipRole((data || []) as Array<{ role_code?: string | null; status?: string | null }>);
  } catch (error) {
    if (error instanceof ProjectMembershipAuthorizationModelError) {
      throw projectMembershipAuthError(500, 'membership_lookup_failed', 'Dữ liệu thành viên dự án không hợp lệ. Vui lòng liên hệ quản trị viên.');
    }
    throw error;
  }
}

async function hasGlobalProjectManage(authContext: AuthContext): Promise<boolean> {
  if (hasAdminAccess(authContext.employee)) return true;

  const [adminWorkspace, projectManage] = await Promise.all([
    checkWorkspaceAccess(authContext, 'ADMIN_WORKSPACE'),
    checkPermissionAccess(authContext, 'PROJECT_MANAGE'),
  ]);
  if (!adminWorkspace.ok || !projectManage.ok) {
    throw projectMembershipAuthError(500, 'project_authorization_failed', 'Chưa thể xác minh quyền dự án. Vui lòng thử lại.');
  }
  return adminWorkspace.hasAccess && projectManage.hasAccess;
}

async function hasGlobalProjectView(authContext: AuthContext): Promise<boolean> {
  if (hasAdminAccess(authContext.employee)) return true;

  const [adminWorkspace, projectManage, projectView] = await Promise.all([
    checkWorkspaceAccess(authContext, 'ADMIN_WORKSPACE'),
    checkPermissionAccess(authContext, 'PROJECT_MANAGE'),
    checkPermissionAccess(authContext, 'PROJECT_VIEW'),
  ]);
  if (!adminWorkspace.ok || !projectManage.ok || !projectView.ok) {
    throw projectMembershipAuthError(500, 'project_authorization_failed', 'Chưa thể xác minh quyền dự án. Vui lòng thử lại.');
  }
  return adminWorkspace.hasAccess && (projectManage.hasAccess || projectView.hasAccess);
}

export async function getProjectMembershipAuthorization(projectId: number): Promise<ProjectMembershipAuthorizationContext> {
  const authContext = await resolveAuthContext();
  const employeeId = actorEmployeeId(authContext);
  // Establish existence first so an unrelated membership/permission lookup failure
  // cannot turn a missing project into a generic authorization error.
  const projectStatus = await loadProjectStatus(projectId);
  const [globalManage, globalView, role] = await Promise.all([
    hasGlobalProjectManage(authContext),
    hasGlobalProjectView(authContext),
    loadProjectRole(projectId, employeeId),
  ]);
  const projectRole = globalManage ? 'GLOBAL_PROJECT_MANAGE' : role;
  const capabilities = globalView && !globalManage && !role
    ? GLOBAL_PROJECT_VIEW_CAPABILITIES
    : capabilitiesForProjectRole(projectRole, projectStatus);
  return {
    authContext,
    actorEmployeeId: employeeId,
    projectId,
    projectStatus,
    projectRole,
    capabilities,
  };
}

export async function requireProjectMembershipAction(projectId: number, action: ProjectMembershipAction): Promise<ProjectMembershipAuthorizationContext> {
  const context = await getProjectMembershipAuthorization(projectId);
  if (action === 'PROJECT_VIEW' && context.capabilities.canViewProject) return context;
  if (!canProjectMembershipPerformAction(context.projectRole, action, context.projectStatus)) {
    const missingMembership = context.projectRole === null;
    throw projectMembershipAuthError(
      403,
      action === 'PROJECT_VIEW' && missingMembership ? 'project_membership_required' : 'project_forbidden',
      action === 'PROJECT_VIEW' && missingMembership
        ? 'Bạn cần là thành viên của dự án để xem nội dung này.'
        : 'Bạn không có quyền thực hiện thao tác này.'
    );
  }
  return context;
}
