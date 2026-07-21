import 'server-only';

import { createSupabaseAdminClient } from '@/utils/supabase/admin';
import {
  AuthContext,
  AuthFlowError,
  hasAdminAccess,
  hasPermission,
  hasWorkspaceAccess,
  requireAuthenticatedEmployee,
} from '@/services/server/auth';
import {
  PhaseAction,
  PhaseAuthorizationModelError,
  ProjectRoleCode,
  canGlobalProjectManagerPerformPhaseAction,
  canProjectRolePerformPhaseAction,
  isCancelledProjectStatus,
  isPhaseAction,
  resolveSingleActiveProjectRole,
} from '@/services/server/phaseAuthorizationCore';

interface ProjectRow {
  id: number;
  status?: string | null;
}

interface PhaseRow {
  id: number;
  project_id: number | null;
}

interface ProjectMembershipRow {
  role_code?: string | null;
  status?: string | null;
}

interface AssignableEmployeeRow {
  id: number;
  status?: string | null;
  is_active?: boolean | null;
}

export interface PhaseAuthorizationContext {
  action: PhaseAction;
  actorEmployeeId: number;
  authContext: AuthContext;
  projectId: number;
  phaseId?: number;
  projectRole: ProjectRoleCode | 'GLOBAL_PROJECT_MANAGE';
}

type PhaseAuthorizationErrorCode =
  | 'phase_unauthenticated'
  | 'phase_permission_denied'
  | 'project_not_found'
  | 'phase_not_found'
  | 'project_cancelled'
  | 'phase_project_mismatch'
  | 'phase_invalid_action'
  | 'phase_authorization_failed';

function phaseAuthorizationError({
  status,
  code,
  message,
  safeDetails,
}: {
  status: number;
  code: PhaseAuthorizationErrorCode;
  message: string;
  safeDetails?: Record<string, boolean | number | string | null>;
}) {
  return new AuthFlowError({
    status,
    code,
    message,
    failureStage:
      status === 401
        ? 'auth_get_user'
        : status === 403
          ? 'permission_check'
          : 'unknown',
    safeDetails,
  });
}

function actorEmployeeId(authContext: AuthContext): number {
  const employeeId = Number(authContext.employee.id);
  if (!Number.isInteger(employeeId) || employeeId <= 0) {
      throw phaseAuthorizationError({
        status: 403,
        code: 'phase_permission_denied',
        message: 'Không thể xác định nhân sự thao tác.',
      });
  }

  return employeeId;
}

async function resolveAuthContext(): Promise<AuthContext> {
  try {
    return await requireAuthenticatedEmployee();
  } catch (error) {
    if (error instanceof AuthFlowError) {
      throw phaseAuthorizationError({
        status: error.status === 401 ? 401 : error.status === 500 ? 500 : 403,
        code:
          error.status === 401
            ? 'phase_unauthenticated'
            : error.status === 500
              ? 'phase_authorization_failed'
              : 'phase_permission_denied',
        message:
          error.status === 401
            ? 'Phiên đăng nhập chưa được xác nhận.'
            : error.status === 500
              ? 'Không thể xác minh quyền giai đoạn.'
              : 'Bạn không có quyền thao tác giai đoạn.',
        safeDetails: error.safeDetails,
      });
    }

    throw error;
  }
}

async function hasGlobalPhaseAccess(
  authContext: AuthContext,
  action: PhaseAction
): Promise<boolean> {
  if (hasAdminAccess(authContext.employee)) return true;

  const hasAdminWorkspace = await hasWorkspaceAccess(authContext, 'ADMIN_WORKSPACE');
  if (!hasAdminWorkspace) return false;

  if (action === 'PHASE_VIEW') {
    const [canManageProjects, canViewProjects] = await Promise.all([
      hasPermission(authContext, 'PROJECT_MANAGE'),
      hasPermission(authContext, 'PROJECT_VIEW'),
    ]);

    return canManageProjects || canViewProjects;
  }

  const canManageProjects = await hasPermission(authContext, 'PROJECT_MANAGE');

  return canManageProjects && canGlobalProjectManagerPerformPhaseAction(action);
}

async function loadProject(projectId: number): Promise<ProjectRow> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('projects')
    .select('id, status')
    .eq('id', projectId)
    .maybeSingle();

  if (error) {
    throw phaseAuthorizationError({
      status: 500,
      code: 'phase_authorization_failed',
      message: 'Không thể xác minh dự án.',
      safeDetails: {
        supabase_error_code: error.code ?? 'unknown',
      },
    });
  }

  if (!data) {
    throw phaseAuthorizationError({
      status: 404,
      code: 'project_not_found',
      message: 'Không tìm thấy dự án.',
    });
  }

  return data as ProjectRow;
}

async function loadPhase(phaseId: number, projectId: number): Promise<PhaseRow> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('phases')
    .select('id, project_id')
    .eq('id', phaseId)
    .maybeSingle();

  if (error) {
    throw phaseAuthorizationError({
      status: 500,
      code: 'phase_authorization_failed',
      message: 'Không thể xác minh giai đoạn.',
      safeDetails: {
        supabase_error_code: error.code ?? 'unknown',
      },
    });
  }

  if (!data) {
    throw phaseAuthorizationError({
      status: 404,
      code: 'phase_not_found',
      message: 'Không tìm thấy giai đoạn.',
    });
  }

  const phase = data as PhaseRow;
  if (Number(phase.project_id) !== projectId) {
    throw phaseAuthorizationError({
      status: 409,
      code: 'phase_project_mismatch',
      message: 'Giai đoạn không thuộc dự án trong đường dẫn.',
    });
  }

  return phase;
}

async function loadProjectRole(
  projectId: number,
  employeeId: number
): Promise<ProjectRoleCode | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('project_members')
    .select('role_code, status')
    .eq('project_id', projectId)
    .eq('employee_id', employeeId)
    .eq('status', 'ACTIVE');

  if (error) {
    throw phaseAuthorizationError({
      status: 500,
      code: 'phase_authorization_failed',
      message: 'Không thể xác minh vai trò dự án.',
      safeDetails: {
        supabase_error_code: error.code ?? 'unknown',
      },
    });
  }

  try {
    return resolveSingleActiveProjectRole((data || []) as ProjectMembershipRow[]);
  } catch (error) {
    if (error instanceof PhaseAuthorizationModelError) {
      console.warn('[phase-authorization]', {
        code: error.code,
        project_id: projectId,
        employee_id: employeeId,
      });

      throw phaseAuthorizationError({
        status: 500,
        code: 'phase_authorization_failed',
        message: 'Không thể xác minh vai trò dự án.',
        safeDetails: {
          duplicate_active_membership: true,
        },
      });
    }

    throw error;
  }
}

function isActiveAssignableEmployee(employee: AssignableEmployeeRow): boolean {
  return (
    String(employee.status || '').trim().toUpperCase() === 'ACTIVE' &&
    employee.is_active !== false
  );
}

async function assertAssignableProjectMember(
  projectId: number,
  targetAssigneeEmployeeId: number
) {
  if (!Number.isInteger(targetAssigneeEmployeeId) || targetAssigneeEmployeeId <= 0) {
    throw phaseAuthorizationError({
      status: 422,
      code: 'phase_invalid_action',
      message: 'NhÃ¢n sá»± Ä‘Æ°á»£c giao khÃ´ng há»£p lá»‡.',
    });
  }

  const supabase = createSupabaseAdminClient();
  const { data: employee, error: employeeError } = await supabase
    .from('employees')
    .select('id, status, is_active')
    .eq('id', targetAssigneeEmployeeId)
    .maybeSingle();

  if (employeeError) {
    throw phaseAuthorizationError({
      status: 500,
      code: 'phase_authorization_failed',
      message: 'KhÃ´ng thá»ƒ xÃ¡c minh nhÃ¢n sá»± Ä‘Æ°á»£c giao.',
      safeDetails: {
        supabase_error_code: employeeError.code ?? 'unknown',
      },
    });
  }

  if (!employee || !isActiveAssignableEmployee(employee as AssignableEmployeeRow)) {
    throw phaseAuthorizationError({
      status: 403,
      code: 'phase_permission_denied',
      message: 'NhÃ¢n sá»± Ä‘Æ°á»£c giao khÃ´ng cÃ³ quyá»n trong dá»± Ã¡n.',
      safeDetails: {
        assignee_active_project_member: false,
      },
    });
  }

  const { data: memberships, error: membershipError } = await supabase
    .from('project_members')
    .select('role_code, status')
    .eq('project_id', projectId)
    .eq('employee_id', targetAssigneeEmployeeId)
    .eq('status', 'ACTIVE');

  if (membershipError) {
    throw phaseAuthorizationError({
      status: 500,
      code: 'phase_authorization_failed',
      message: 'KhÃ´ng thá»ƒ xÃ¡c minh nhÃ¢n sá»± trong dá»± Ã¡n.',
      safeDetails: {
        supabase_error_code: membershipError.code ?? 'unknown',
      },
    });
  }

  try {
    const projectRole = resolveSingleActiveProjectRole(
      (memberships || []) as ProjectMembershipRow[]
    );

    if (projectRole) return;
  } catch (error) {
    if (error instanceof PhaseAuthorizationModelError) {
      console.warn('[phase-authorization]', {
        code: error.code,
        project_id: projectId,
        target_assignee_employee_id: targetAssigneeEmployeeId,
      });

      throw phaseAuthorizationError({
        status: 500,
        code: 'phase_authorization_failed',
        message: 'KhÃ´ng thá»ƒ xÃ¡c minh nhÃ¢n sá»± trong dá»± Ã¡n.',
        safeDetails: {
          assignee_membership_model_error: true,
        },
      });
    }

    throw error;
  }

  throw phaseAuthorizationError({
    status: 403,
    code: 'phase_permission_denied',
    message: 'NhÃ¢n sá»± Ä‘Æ°á»£c giao khÃ´ng cÃ³ quyá»n trong dá»± Ã¡n.',
    safeDetails: {
      assignee_active_project_member: false,
    },
  });
}

export async function requirePhaseMutationAccess({
  projectId,
  phaseId,
  action,
  targetAssigneeEmployeeId,
}: {
  projectId: number;
  phaseId?: number;
  action: PhaseAction;
  targetAssigneeEmployeeId?: number;
}): Promise<PhaseAuthorizationContext> {
  if (!isPhaseAction(action)) {
    throw phaseAuthorizationError({
      status: 422,
      code: 'phase_invalid_action',
      message: 'Hành động giai đoạn không hợp lệ.',
    });
  }

  const authContext = await resolveAuthContext();
  const employeeId = actorEmployeeId(authContext);
  const project = await loadProject(projectId);

  if (phaseId !== undefined) {
    await loadPhase(phaseId, projectId);
  }

  if (action !== 'PHASE_VIEW' && isCancelledProjectStatus(project.status)) {
    throw phaseAuthorizationError({
      status: 409,
      code: 'project_cancelled',
      message: 'Dự án đã hủy, không thể thay đổi giai đoạn.',
    });
  }

  if (await hasGlobalPhaseAccess(authContext, action)) {
    if (action === 'PHASE_ASSIGN' && targetAssigneeEmployeeId !== undefined) {
      await assertAssignableProjectMember(projectId, targetAssigneeEmployeeId);
    }

    return {
      action,
      actorEmployeeId: employeeId,
      authContext,
      projectId,
      phaseId,
      projectRole: 'GLOBAL_PROJECT_MANAGE',
    };
  }

  const projectRole = await loadProjectRole(projectId, employeeId);
  if (!projectRole || !canProjectRolePerformPhaseAction(projectRole, action)) {
    throw phaseAuthorizationError({
      status: 403,
      code: 'phase_permission_denied',
      message: 'Bạn không có quyền thao tác giai đoạn này.',
      safeDetails: {
        project_role: projectRole ?? 'none',
      },
    });
  }

  if (action === 'PHASE_ASSIGN' && targetAssigneeEmployeeId !== undefined) {
    await assertAssignableProjectMember(projectId, targetAssigneeEmployeeId);
  }

  return {
    action,
    actorEmployeeId: employeeId,
    authContext,
    projectId,
    phaseId,
    projectRole,
  };
}
