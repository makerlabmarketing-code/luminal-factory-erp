import { NextResponse } from 'next/server';

import type { AuthContext } from '@/services/server/auth';
import { AuthFlowError } from '@/services/server/auth';
import { requireAdminEmployeePermission } from '@/services/server/adminEmployeeData';
import type { AdminAccountDetailDto } from '@/services/server/adminAccountManagement';
import { createSupabaseAdminClient } from '@/utils/supabase/admin';
import {
  ACCOUNT_PRESETS,
  ALL_PERMISSION_CODES,
  type AccountPresetCode,
  type PermissionCode,
  type PermissionEditorState,
  type WorkspaceCode,
} from '@/lib/account-permissions';

type AccountConnectionStatus =
  | 'NOT_CONNECTED'
  | 'MISSING_EMAIL'
  | 'INVITED'
  | 'PENDING_PASSWORD'
  | 'CONNECTED'
  | 'ACCESS_REVOKED'
  | 'LINK_ERROR';
type DetectedPresetCode = AccountPresetCode | 'CUSTOM' | 'NONE';

interface EmployeeAccountRow {
  id: number | string;
  full_name: string | null;
  email: string | null;
  status: string | null;
  role?: string | null;
  is_active?: boolean | null;
  auth_user_id?: string | null;
}

interface WorkspaceAccessRow {
  employee_id: number | string;
  workspace: string | null;
  status: string | null;
  revoked_at?: string | null;
}

interface PermissionRow {
  employee_id: number | string;
  permission_code: string | null;
  effect: string | null;
  status: string | null;
  revoked_at?: string | null;
}

interface AuthUserSummary {
  id: string;
  invited_at?: string;
  confirmed_at?: string;
  email_confirmed_at?: string;
  last_sign_in_at?: string;
  banned_until?: string;
}

function jsonNoStore(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

function toErrorResponse(error: unknown) {
  if (error instanceof AuthFlowError) {
    return jsonNoStore({ success: false, message: error.message }, { status: error.status });
  }

  return jsonNoStore(
    { success: false, message: 'Không thể tải chi tiết tài khoản.' },
    { status: 500 }
  );
}

function normalizeEmail(value?: string | null) {
  return (value || '').trim().toLowerCase();
}

function isSystemOwner(employee: EmployeeAccountRow) {
  return (employee.role || '').trim().toUpperCase() === 'OWNER';
}

function isActiveWorkspace(row: WorkspaceAccessRow) {
  return row.status === 'ACTIVE' && !row.revoked_at;
}

function isActivePermission(row: PermissionRow) {
  return row.status === 'ACTIVE' && !row.revoked_at;
}

function hasWorkspace(
  employee: EmployeeAccountRow,
  rows: WorkspaceAccessRow[],
  workspace: WorkspaceCode
) {
  return rows.some(
    (row) =>
      String(row.employee_id) === String(employee.id) &&
      row.workspace === workspace &&
      isActiveWorkspace(row)
  );
}

function permissionStateFor(
  employee: EmployeeAccountRow,
  rows: PermissionRow[],
  permissionCode: PermissionCode
): PermissionEditorState {
  const activeRows = rows.filter(
    (row) =>
      String(row.employee_id) === String(employee.id) &&
      row.permission_code === permissionCode &&
      isActivePermission(row)
  );

  if (activeRows.some((row) => row.effect === 'DENY')) return 'DENY';
  if (activeRows.some((row) => row.effect === 'ALLOW')) return 'ALLOW';
  return 'NONE';
}

function activePermissionCount(employee: EmployeeAccountRow, rows: PermissionRow[]) {
  return ALL_PERMISSION_CODES.filter(
    (permissionCode) => permissionStateFor(employee, rows, permissionCode) === 'ALLOW'
  ).length;
}

function detectPreset(
  employee: EmployeeAccountRow,
  workspaceRows: WorkspaceAccessRow[],
  permissionRows: PermissionRow[]
): DetectedPresetCode {
  const activeWorkspaces = new Set<WorkspaceCode>();
  if (hasWorkspace(employee, workspaceRows, 'STAFF_WORKSPACE')) activeWorkspaces.add('STAFF_WORKSPACE');
  if (hasWorkspace(employee, workspaceRows, 'ADMIN_WORKSPACE')) activeWorkspaces.add('ADMIN_WORKSPACE');

  const matchedPreset = ACCOUNT_PRESETS.filter((preset) => preset.code !== 'CUSTOM').find((preset) => {
    if (preset.workspaces.length !== activeWorkspaces.size) return false;
    if (!preset.workspaces.every((workspace) => activeWorkspaces.has(workspace))) return false;

    const presetPermissions = new Set(preset.permissions);
    return ALL_PERMISSION_CODES.every((permissionCode) => {
      const expectedState = presetPermissions.has(permissionCode) ? 'ALLOW' : 'NONE';
      return permissionStateFor(employee, permissionRows, permissionCode) === expectedState;
    });
  });

  if (matchedPreset) return matchedPreset.code;
  if (activeWorkspaces.size === 0 && activePermissionCount(employee, permissionRows) === 0) return 'NONE';
  return 'CUSTOM';
}

function resolveAccountStatus(
  employee: EmployeeAccountRow,
  authUser: AuthUserSummary | null,
  workspaceRows: WorkspaceAccessRow[]
): AccountConnectionStatus {
  if (!employee.auth_user_id && !normalizeEmail(employee.email)) return 'MISSING_EMAIL';
  if (!employee.auth_user_id) return 'NOT_CONNECTED';
  if (!authUser) return 'LINK_ERROR';
  if (authUser.banned_until) return 'ACCESS_REVOKED';
  if (
    !hasWorkspace(employee, workspaceRows, 'STAFF_WORKSPACE') &&
    !hasWorkspace(employee, workspaceRows, 'ADMIN_WORKSPACE')
  ) return 'ACCESS_REVOKED';

  const confirmed = Boolean(authUser.confirmed_at || authUser.email_confirmed_at);
  if (!confirmed && authUser.invited_at) return 'INVITED';
  if (!authUser.last_sign_in_at) return 'PENDING_PASSWORD';
  return 'CONNECTED';
}

function actorEmployeeId(authContext: AuthContext) {
  return String(authContext.employee.id);
}

async function loadScopedAccountDetail(
  employeeIdValue: string,
  authContext: AuthContext
): Promise<AdminAccountDetailDto> {
  const supabaseAdmin = createSupabaseAdminClient();
  const [employeeResult, workspaceResult, permissionResult] = await Promise.all([
    supabaseAdmin
      .from('employees')
      .select('id, full_name, email, status, role, is_active, auth_user_id')
      .eq('id', employeeIdValue)
      .maybeSingle(),
    supabaseAdmin
      .from('employee_workspace_access')
      .select('employee_id, workspace, status, revoked_at')
      .eq('employee_id', employeeIdValue),
    supabaseAdmin
      .from('employee_permissions')
      .select('employee_id, permission_code, effect, status, revoked_at')
      .eq('employee_id', employeeIdValue),
  ]);

  if (employeeResult.error || workspaceResult.error || permissionResult.error) {
    throw new AuthFlowError({
      status: 500,
      code: 'admin_verification_failed',
      message: 'Không thể tải chi tiết tài khoản.',
      failureStage: 'permission_check',
      safeDetails: {
        supabase_error_code:
          employeeResult.error?.code || workspaceResult.error?.code || permissionResult.error?.code || 'unknown',
      },
    });
  }
  if (!employeeResult.data) {
    throw new AuthFlowError({
      status: 404,
      code: 'employee_not_linked',
      message: 'Không tìm thấy hồ sơ nhân sự.',
      failureStage: 'employee_lookup',
    });
  }

  const employee = employeeResult.data as EmployeeAccountRow;
  const workspaceRows = (workspaceResult.data || []) as WorkspaceAccessRow[];
  const permissionRows = (permissionResult.data || []) as PermissionRow[];
  let authUser: AuthUserSummary | null = null;

  if (employee.auth_user_id) {
    const { data, error } = await supabaseAdmin.auth.admin.getUserById(employee.auth_user_id);
    if (error) throw error;
    authUser = data.user ? (data.user as AuthUserSummary) : null;
  }

  const hasStaffWorkspace = hasWorkspace(employee, workspaceRows, 'STAFF_WORKSPACE');
  const hasAdminWorkspace = hasWorkspace(employee, workspaceRows, 'ADMIN_WORKSPACE');
  const permissionCount = activePermissionCount(employee, permissionRows);
  const accessStatus =
    hasStaffWorkspace || hasAdminWorkspace || permissionCount > 0
      ? 'ACTIVE'
      : employee.auth_user_id
        ? 'REVOKED'
        : 'NO_ACCESS';

  return {
    employeeId: String(employee.id),
    fullName: employee.full_name || 'Chưa đặt tên',
    email: employee.email || null,
    employmentStatus: employee.status || null,
    accountConnectionStatus: resolveAccountStatus(employee, authUser, workspaceRows),
    hasStaffWorkspace,
    hasAdminWorkspace,
    presetCode: detectPreset(employee, workspaceRows, permissionRows),
    activePermissionCount: permissionCount,
    accessStatus,
    isSelf: String(employee.id) === actorEmployeeId(authContext),
    isSystemOwner: isSystemOwner(employee),
    permissions: ALL_PERMISSION_CODES.map((permissionCode) => {
      const state = permissionStateFor(employee, permissionRows, permissionCode);
      return { code: permissionCode, state, effective: state };
    }),
  };
}

export async function GET(_request: Request, props: { params: Promise<{ employeeId: string }> }) {
  const params = await props.params;
  try {
    const authContext = await requireAdminEmployeePermission('ACCOUNT_MANAGE');
    return jsonNoStore(await loadScopedAccountDetail(params.employeeId, authContext));
  } catch (error) {
    return toErrorResponse(error);
  }
}
