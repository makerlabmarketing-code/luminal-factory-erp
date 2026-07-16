import 'server-only';

import { createClient } from '@/utils/supabase/server';

export class AuthFlowError extends Error {
  status: number;
  code: AuthFlowErrorCode;
  failureStage: AuthFailureStage;
  safeDetails?: Record<string, boolean | number | string | null>;

  constructor({
    status,
    code,
    message,
    failureStage,
    safeDetails,
  }: {
    status: number;
    code: AuthFlowErrorCode;
    message: string;
    failureStage: AuthFailureStage;
    safeDetails?: Record<string, boolean | number | string | null>;
  }) {
    super(message);
    this.name = 'AuthFlowError';
    this.status = status;
    this.code = code;
    this.failureStage = failureStage;
    this.safeDetails = safeDetails;
  }
}

export type AuthFlowErrorCode =
  | 'session_not_verified'
  | 'employee_not_linked'
  | 'employee_inactive'
  | 'admin_forbidden'
  | 'workspace_forbidden'
  | 'permission_forbidden'
  | 'admin_verification_failed'
  | 'payload_validation_failed'
  | 'project_already_exists'
  | 'project_duplicate_check_failed'
  | 'project_insert_failed'
  | 'phase_unauthenticated'
  | 'phase_permission_denied'
  | 'project_not_found'
  | 'phase_not_found'
  | 'project_cancelled'
  | 'phase_project_mismatch'
  | 'phase_invalid_action'
  | 'phase_authorization_failed';

export type AuthFailureStage =
  | 'auth_get_user'
  | 'employee_lookup'
  | 'employee_status'
  | 'admin_role'
  | 'workspace_access'
  | 'permission_check'
  | 'payload_validation'
  | 'duplicate_check'
  | 'admin_client_creation'
  | 'project_insert'
  | 'unknown';

export interface ServerEmployee {
  id: number | string;
  auth_user_id?: string | null;
  employee_id?: number | string | null;
  full_name: string;
  email?: string | null;
  title?: string | null;
  status?: string | null;
  role?: string | null;
  is_manager?: boolean | null;
  is_active?: boolean | null;
  branch?: string | null;
  branch_code?: string | null;
  phone?: string | null;
  bank_name?: string | null;
  bank_account_number?: string | null;
  hourly_rate?: number | string | null;
}

export interface AuthContext {
  authUserId: string;
  email: string | null;
  employee: ServerEmployee;
}

export type WorkspaceCode = 'ADMIN_WORKSPACE' | 'STAFF_WORKSPACE';

export interface WorkspaceAccessDecision {
  allowed: boolean;
  viaWorkspace: boolean;
  viaLegacyFallback: boolean;
  workspace: WorkspaceCode;
}

type AuthContextLookupResult =
  | {
      ok: true;
      authContext: AuthContext;
    }
  | {
      ok: false;
      reason:
        | 'session_not_verified'
        | 'employee_not_linked'
        | 'employee_inactive'
        | 'database_error';
      failureStage: AuthFailureStage;
      safeDetails?: Record<string, boolean | number | string | null>;
    };

export const STAFF_EMPLOYEE_SELECT =
  'id, auth_user_id, full_name, email, title, status, role, is_manager, is_active, branch_code, phone, bank_name, bank_account_number, hourly_rate';

export const ADMIN_EMPLOYEE_AUTH_SELECT =
  'id, auth_user_id, role, status, is_active';

function normalizeRole(role?: string | null): string {
  return (role || '').trim().toUpperCase();
}

function redactSafeDatabaseText(value?: string | null): string | null {
  if (!value) return null;

  return value
    .replace(/[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}/gi, '[uuid]')
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[jwt]');
}

export function isActiveEmployee(employee: ServerEmployee): boolean {
  const status = (employee.status || '').trim().toUpperCase();

  return employee.is_active !== false && status !== 'INACTIVE' && status !== 'LOCKED';
}

export function hasAdminAccess(employee: ServerEmployee): boolean {
  const role = normalizeRole(employee.role);

  return isActiveEmployee(employee) && (role === 'ADMIN' || role === 'OWNER');
}

function logAuthorizationDiagnostic(diagnostic: Record<string, boolean | number | string | null>) {
  console.warn('[authorization]', diagnostic);
}

function employeeIdValue(employee: ServerEmployee): string | number {
  return employee.id;
}

function isActivePermissionRow(row: {
  effect?: string | null;
  status?: string | null;
  revoked_at?: string | null;
}): boolean {
  return row.status === 'ACTIVE' && !row.revoked_at;
}

async function lookupWorkspaceAccess(
  authContext: AuthContext,
  workspaceCode: WorkspaceCode
): Promise<{ ok: true; hasAccess: boolean } | { ok: false; safeDetails: Record<string, string | null> }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('employee_workspace_access')
    .select('id')
    .eq('employee_id', employeeIdValue(authContext.employee))
    .eq('workspace', workspaceCode)
    .eq('status', 'ACTIVE')
    .is('revoked_at', null)
    .limit(1);

  if (error) {
    return {
      ok: false,
      safeDetails: {
        supabase_error_code: error.code ?? 'unknown',
        supabase_error_message: redactSafeDatabaseText(error.message),
        supabase_error_hint: redactSafeDatabaseText(error.hint),
        supabase_error_details: redactSafeDatabaseText(error.details),
      },
    };
  }

  return { ok: true, hasAccess: Boolean(data?.length) };
}

async function lookupPermissionAccess(
  authContext: AuthContext,
  permissionCode: string
): Promise<{ ok: true; hasAccess: boolean } | { ok: false; safeDetails: Record<string, string | null> }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('employee_permissions')
    .select('effect, status, revoked_at')
    .eq('employee_id', employeeIdValue(authContext.employee))
    .eq('permission_code', permissionCode)
    .eq('status', 'ACTIVE')
    .is('revoked_at', null);

  if (error) {
    return {
      ok: false,
      safeDetails: {
        supabase_error_code: error.code ?? 'unknown',
        supabase_error_message: redactSafeDatabaseText(error.message),
        supabase_error_hint: redactSafeDatabaseText(error.hint),
        supabase_error_details: redactSafeDatabaseText(error.details),
      },
    };
  }

  const rows = (data || []) as Array<{
    effect?: string | null;
    status?: string | null;
    revoked_at?: string | null;
  }>;
  const activeRows = rows.filter(isActivePermissionRow);
  const hasDeny = activeRows.some((row) => row.effect === 'DENY');
  const hasAllow = activeRows.some((row) => row.effect === 'ALLOW');

  return { ok: true, hasAccess: !hasDeny && hasAllow };
}

export async function hasWorkspaceAccess(
  authContext: AuthContext,
  workspaceCode: WorkspaceCode
): Promise<boolean> {
  const result = await lookupWorkspaceAccess(authContext, workspaceCode);

  return result.ok && result.hasAccess;
}

export async function hasPermission(
  authContext: AuthContext,
  permissionCode: string
): Promise<boolean> {
  const result = await lookupPermissionAccess(authContext, permissionCode);

  return result.ok && result.hasAccess;
}

export async function canAccessAdmin(
  authContext: AuthContext
): Promise<WorkspaceAccessDecision> {
  const workspaceResult = await lookupWorkspaceAccess(authContext, 'ADMIN_WORKSPACE');
  const viaWorkspace = workspaceResult.ok && workspaceResult.hasAccess;
  const viaLegacyFallback = !viaWorkspace && hasAdminAccess(authContext.employee);

  return {
    allowed: viaWorkspace || viaLegacyFallback,
    viaWorkspace,
    viaLegacyFallback,
    workspace: 'ADMIN_WORKSPACE',
  };
}

export async function canAccessStaff(
  authContext: AuthContext
): Promise<WorkspaceAccessDecision> {
  const workspaceResult = await lookupWorkspaceAccess(authContext, 'STAFF_WORKSPACE');
  const viaWorkspace = workspaceResult.ok && workspaceResult.hasAccess;

  return {
    allowed: viaWorkspace,
    viaWorkspace,
    viaLegacyFallback: false,
    workspace: 'STAFF_WORKSPACE',
  };
}

export async function requireCurrentEmployee(): Promise<AuthContext> {
  return requireAuthenticatedEmployee();
}

export async function requireWorkspaceAccess(
  workspaceCode: WorkspaceCode,
  options: { allowLegacyAdminFallback?: boolean } = {}
): Promise<AuthContext> {
  const authContext = await requireAuthenticatedEmployeeWithSelect(
    workspaceCode === 'ADMIN_WORKSPACE' ? ADMIN_EMPLOYEE_AUTH_SELECT : STAFF_EMPLOYEE_SELECT
  );
  const workspaceResult = await lookupWorkspaceAccess(authContext, workspaceCode);

  if (!workspaceResult.ok) {
    throw new AuthFlowError({
      status: 500,
      code: 'admin_verification_failed',
      message: 'Không thể xác minh quyền truy cập. Vui lòng thử lại.',
      failureStage: 'workspace_access',
      safeDetails: workspaceResult.safeDetails,
    });
  }

  const legacyAllowed =
    (workspaceCode === 'ADMIN_WORKSPACE' &&
      options.allowLegacyAdminFallback === true &&
      hasAdminAccess(authContext.employee));

  if (!workspaceResult.hasAccess && !legacyAllowed) {
    throw new AuthFlowError({
      status: 403,
      code: 'workspace_forbidden',
      message: 'Tài khoản chưa được cấp quyền truy cập.',
      failureStage: 'workspace_access',
      safeDetails: {
        workspace_code: workspaceCode,
      },
    });
  }

  if (!workspaceResult.hasAccess && legacyAllowed) {
    logAuthorizationDiagnostic({
      stage: 'workspace_access',
      code: 'legacy_workspace_fallback',
      workspace: workspaceCode,
      employee_lookup_result_count: 1,
    });
  }

  return authContext;
}

export async function requirePermission(permissionCode: string): Promise<AuthContext> {
  const authContext = await requireAuthenticatedEmployee();
  const permissionResult = await lookupPermissionAccess(authContext, permissionCode);

  if (!permissionResult.ok) {
    throw new AuthFlowError({
      status: 500,
      code: 'admin_verification_failed',
      message: 'Không thể xác minh quyền truy cập. Vui lòng thử lại.',
      failureStage: 'permission_check',
      safeDetails: permissionResult.safeDetails,
    });
  }

  if (!permissionResult.hasAccess) {
    throw new AuthFlowError({
      status: 403,
      code: 'permission_forbidden',
      message: 'Bạn không có quyền thực hiện thao tác này.',
      failureStage: 'permission_check',
      safeDetails: {
        permission_check_result: 'denied',
      },
    });
  }

  return authContext;
}

export function toPublicStaffEmployee(employee: ServerEmployee) {
  return {
    id: employee.id,
    employee_id: employee.employee_id ?? null,
    full_name: employee.full_name,
    email: employee.email ?? null,
    title: employee.title ?? null,
    status: employee.status ?? null,
    branch: employee.branch ?? null,
    branch_code: employee.branch_code ?? null,
    phone: employee.phone ?? null,
    bank_name: employee.bank_name ?? null,
    bank_account_number: employee.bank_account_number ?? null,
    hourly_rate: employee.hourly_rate ?? null,
  };
}

async function getServerAuthContextLookup(
  employeeSelect = STAFF_EMPLOYEE_SELECT
): Promise<AuthContextLookupResult> {
  const supabase = await createClient();
  const { data: userResult, error: userError } = await supabase.auth.getUser();
  const user = userResult.user;

  if (userError || !user) {
    return {
      ok: false,
      reason: 'session_not_verified',
      failureStage: 'auth_get_user',
      safeDetails: {
        get_user_success: false,
      },
    };
  }

  const email = user.email || null;
  if (!email) {
    return {
      ok: false,
      reason: 'session_not_verified',
      failureStage: 'auth_get_user',
      safeDetails: {
        get_user_success: false,
      },
    };
  }

  const { data: employee, error: employeeError } = await supabase
    .from('employees')
    .select(employeeSelect)
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (employeeError) {
    return {
      ok: false,
      reason: 'database_error',
      failureStage: 'employee_lookup',
      safeDetails: {
        get_user_success: true,
        employee_lookup_result_count: 0,
        supabase_error_code: employeeError.code ?? 'unknown',
        supabase_error_message: redactSafeDatabaseText(employeeError.message),
        supabase_error_hint: redactSafeDatabaseText(employeeError.hint),
        supabase_error_details: redactSafeDatabaseText(employeeError.details),
      },
    };
  }
  if (!employee) {
    return {
      ok: false,
      reason: 'employee_not_linked',
      failureStage: 'employee_lookup',
      safeDetails: {
        get_user_success: true,
        employee_lookup_result_count: 0,
      },
    };
  }

  const serverEmployee = employee as unknown as ServerEmployee;
  if (!isActiveEmployee(serverEmployee)) {
    return {
      ok: false,
      reason: 'employee_inactive',
      failureStage: 'employee_status',
      safeDetails: {
        get_user_success: true,
        employee_lookup_result_count: 1,
      },
    };
  }

  return {
    ok: true,
    authContext: {
      authUserId: user.id,
      email,
      employee: serverEmployee,
    },
  };
}

export async function getServerAuthContext(): Promise<AuthContext | null> {
  const result = await getServerAuthContextLookup();

  return result.ok ? result.authContext : null;
}

export async function getServerAdminAuthContext(): Promise<AuthContext | null> {
  const result = await getServerAuthContextLookup(ADMIN_EMPLOYEE_AUTH_SELECT);

  return result.ok ? result.authContext : null;
}

export async function requireAuthenticatedEmployee(): Promise<AuthContext> {
  return requireAuthenticatedEmployeeWithSelect(STAFF_EMPLOYEE_SELECT);
}

async function requireAuthenticatedEmployeeWithSelect(employeeSelect: string): Promise<AuthContext> {
  const result = await getServerAuthContextLookup(employeeSelect);

  if (!result.ok) {
    if (result.reason === 'employee_not_linked') {
      throw new AuthFlowError({
        status: 404,
        code: 'employee_not_linked',
        message: 'Tài khoản chưa được liên kết với nhân viên.',
        failureStage: result.failureStage,
        safeDetails: result.safeDetails,
      });
    }

    if (result.reason === 'employee_inactive') {
      throw new AuthFlowError({
        status: 403,
        code: 'employee_inactive',
        message: 'Bạn không có quyền truy cập khu vực quản trị.',
        failureStage: result.failureStage,
        safeDetails: result.safeDetails,
      });
    }

    if (result.reason === 'database_error') {
      throw new AuthFlowError({
        status: 500,
        code: 'admin_verification_failed',
        message: 'Không thể xác minh quyền quản trị. Vui lòng thử lại.',
        failureStage: result.failureStage,
        safeDetails: result.safeDetails,
      });
    }

    throw new AuthFlowError({
      status: 401,
      code: 'session_not_verified',
      message: 'Phiên đăng nhập chưa được xác nhận. Vui lòng đăng nhập lại.',
      failureStage: result.failureStage,
      safeDetails: result.safeDetails,
    });
  }

  return result.authContext;
}

export async function requireAdminEmployee(): Promise<AuthContext> {
  const result = await getServerAuthContextLookup(ADMIN_EMPLOYEE_AUTH_SELECT);

  if (!result.ok) {
    if (result.reason === 'employee_not_linked') {
      throw new AuthFlowError({
        status: 404,
        code: 'employee_not_linked',
        message: 'Tài khoản chưa được liên kết với nhân viên.',
        failureStage: result.failureStage,
        safeDetails: result.safeDetails,
      });
    }

    if (result.reason === 'employee_inactive') {
      throw new AuthFlowError({
        status: 403,
        code: 'employee_inactive',
        message: 'Bạn không có quyền truy cập khu vực quản trị.',
        failureStage: result.failureStage,
        safeDetails: result.safeDetails,
      });
    }

    if (result.reason === 'database_error') {
      throw new AuthFlowError({
        status: 500,
        code: 'admin_verification_failed',
        message: 'Không thể xác minh quyền quản trị. Vui lòng thử lại.',
        failureStage: result.failureStage,
        safeDetails: result.safeDetails,
      });
    }

    throw new AuthFlowError({
      status: 401,
      code: 'session_not_verified',
      message: 'Phiên đăng nhập chưa được xác nhận. Vui lòng đăng nhập lại.',
      failureStage: result.failureStage,
      safeDetails: result.safeDetails,
    });
  }

  const authContext = result.authContext;
  const adminDecision = await canAccessAdmin(authContext);

  if (!adminDecision.allowed) {
    throw new AuthFlowError({
      status: 403,
      code: 'admin_forbidden',
      message: 'Bạn không có quyền truy cập khu vực quản trị.',
      failureStage: 'workspace_access',
      safeDetails: {
        get_user_success: true,
        employee_lookup_result_count: 1,
      },
    });
  }

  if (adminDecision.viaLegacyFallback) {
    logAuthorizationDiagnostic({
      stage: 'workspace_access',
      code: 'legacy_admin_fallback',
      employee_lookup_result_count: 1,
    });
  }

  return authContext;
}
