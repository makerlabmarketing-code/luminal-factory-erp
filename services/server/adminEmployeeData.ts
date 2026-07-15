import 'server-only';

import { createClient } from '@/utils/supabase/server';
import { createSupabaseAdminClient } from '@/utils/supabase/admin';
import {
  AuthFlowError,
  hasPermission,
  requireWorkspaceAccess,
  type AuthContext,
} from '@/services/server/auth';

export type AccountConnectionStatus =
  | 'NOT_CONNECTED'
  | 'MISSING_EMAIL'
  | 'INVITED'
  | 'PENDING_PASSWORD'
  | 'CONNECTED'
  | 'INVITE_ERROR'
  | 'INVITE_EXPIRED'
  | 'ACCESS_REVOKED'
  | 'LINK_ERROR';

export type InvitationStatus =
  | 'NONE'
  | 'READY_TO_INVITE'
  | 'INVITED'
  | 'PENDING_PASSWORD'
  | 'ERROR'
  | 'EXPIRED'
  | 'REVOKED';

export interface EmployeeListItem {
  employeeId: string;
  fullName: string;
  title: string | null;
  email: string | null;
  employmentStatus: string | null;
  facilityName: string | null;
  accountConnectionStatus: AccountConnectionStatus;
  invitationStatus: InvitationStatus;
  canEdit: boolean;
  canManageAccount: boolean;
}

interface EmployeeRow {
  id: number | string;
  full_name: string | null;
  title: string | null;
  email: string | null;
  status: string | null;
  is_active?: boolean | null;
  auth_user_id?: string | null;
  branch_code?: string | null;
  phone?: string | null;
  hourly_rate?: number | string | null;
  created_at?: string | null;
}

interface FacilityRow {
  id: number | string;
  name?: string | null;
  facility_name?: string | null;
  code?: string | null;
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

interface ProjectMembershipRow {
  project_id: number | string;
  member_role: string | null;
  status: string | null;
  projects?: {
    name?: string | null;
  } | null;
}

interface AuthUserSummary {
  id: string;
  email?: string;
  invited_at?: string;
  confirmation_sent_at?: string;
  confirmed_at?: string;
  email_confirmed_at?: string;
  last_sign_in_at?: string;
  banned_until?: string;
}

export interface AdminEmployeeListData {
  employees: EmployeeListItem[];
  capabilities: {
    canViewEmployees: boolean;
    canEditEmployees: boolean;
    canManageAccounts: boolean;
  };
}

export interface EmployeePermissionSummary {
  permissionCode: string;
  effect: string;
}

export interface EmployeeProjectMembershipSummary {
  projectId: string;
  projectName: string;
  memberRole: string;
  status: string;
}

export interface EmployeeDetailDto {
  employeeId: string;
  fullName: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  employmentStatus: string | null;
  facility: string | null;
  hourlyRate: number | string | null;
  createdAt: string | null;
  accountConnectionStatus: AccountConnectionStatus;
  invitationStatus: InvitationStatus;
  hasStaffWorkspace: boolean;
  hasAdminWorkspace: boolean;
  permissions: EmployeePermissionSummary[];
  projectMemberships: EmployeeProjectMembershipSummary[];
  capabilities: {
    canEditEmployee: boolean;
    canManageAccount: boolean;
    canViewCompensation: boolean;
  };
}

function normalizeText(value?: string | null): string {
  return (value || '').trim();
}

function normalizeEmail(value?: string | null): string {
  return normalizeText(value).toLowerCase();
}

function resolveFacilityName(employee: EmployeeRow, facilities: FacilityRow[]): string | null {
  const branchCode = normalizeText(employee.branch_code);

  const matched = facilities.find((facility) => {
    const id = String(facility.id || '');
    const code = normalizeText(facility.code);
    const name = normalizeText(facility.name);
    const facilityName = normalizeText(facility.facility_name);

    return (
      branchCode && (branchCode === id || branchCode === code || branchCode === name || branchCode === facilityName)
    );
  });

  return matched?.facility_name || matched?.name || branchCode || null;
}

function isAccessRevoked(employee: EmployeeRow, workspaceRows: WorkspaceAccessRow[]): boolean {
  if (!employee.auth_user_id) return false;

  const rows = workspaceRows.filter((row) => String(row.employee_id) === String(employee.id));
  if (rows.length === 0) return false;

  return rows.every((row) => row.status !== 'ACTIVE' || Boolean(row.revoked_at));
}

function resolveAccountStatus(
  employee: EmployeeRow,
  authUser: AuthUserSummary | null,
  workspaceRows: WorkspaceAccessRow[]
): Pick<EmployeeListItem, 'accountConnectionStatus' | 'invitationStatus'> {
  const email = normalizeEmail(employee.email);

  if (!employee.auth_user_id && !email) {
    return { accountConnectionStatus: 'MISSING_EMAIL', invitationStatus: 'NONE' };
  }

  if (!employee.auth_user_id) {
    return { accountConnectionStatus: 'NOT_CONNECTED', invitationStatus: 'READY_TO_INVITE' };
  }

  if (!authUser) {
    return { accountConnectionStatus: 'LINK_ERROR', invitationStatus: 'ERROR' };
  }

  if (isAccessRevoked(employee, workspaceRows) || authUser.banned_until) {
    return { accountConnectionStatus: 'ACCESS_REVOKED', invitationStatus: 'REVOKED' };
  }

  const confirmed = Boolean(authUser.confirmed_at || authUser.email_confirmed_at);
  if (!confirmed && authUser.invited_at) {
    return { accountConnectionStatus: 'INVITED', invitationStatus: 'INVITED' };
  }

  if (!authUser.last_sign_in_at) {
    return { accountConnectionStatus: 'PENDING_PASSWORD', invitationStatus: 'PENDING_PASSWORD' };
  }

  return { accountConnectionStatus: 'CONNECTED', invitationStatus: 'NONE' };
}

async function listAuthUsersById(): Promise<Map<string, AuthUserSummary>> {
  const supabaseAdmin = createSupabaseAdminClient();
  const users = new Map<string, AuthUserSummary>();
  let page = 1;
  const perPage = 1000;

  while (page < 20) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    (data.users || []).forEach((user) => {
      users.set(user.id, user as AuthUserSummary);
    });

    if (!data.users || data.users.length < perPage) break;
    page += 1;
  }

  return users;
}

export async function requireAdminEmployeePermission(
  permissionCode: 'EMPLOYEE_VIEW' | 'EMPLOYEE_MANAGE' | 'ACCOUNT_MANAGE'
): Promise<AuthContext> {
  const authContext = await requireWorkspaceAccess('ADMIN_WORKSPACE');
  const allowed = await hasPermission(authContext, permissionCode);

  if (!allowed) {
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

export async function getAdminEmployeeListData(): Promise<AdminEmployeeListData> {
  const authContext = await requireAdminEmployeePermission('EMPLOYEE_VIEW');
  const [canEditEmployees, canManageAccounts] = await Promise.all([
    hasPermission(authContext, 'EMPLOYEE_MANAGE'),
    hasPermission(authContext, 'ACCOUNT_MANAGE'),
  ]);
  const supabase = await createClient();

  const [{ data: employees, error: employeeError }, { data: facilities }, { data: workspaceAccess }] =
    await Promise.all([
      supabase
        .from('employees')
        .select('id, full_name, title, email, status, is_active, auth_user_id, branch_code')
        .order('id', { ascending: false }),
      supabase.from('facilities').select('id, name, facility_name, code'),
      supabase
        .from('employee_workspace_access')
        .select('employee_id, workspace, status, revoked_at'),
    ]);

  if (employeeError) {
    throw new AuthFlowError({
      status: 500,
      code: 'admin_verification_failed',
      message: 'Không thể tải danh sách nhân sự.',
      failureStage: 'permission_check',
      safeDetails: {
        supabase_error_code: employeeError.code ?? 'unknown',
      },
    });
  }

  const authUsersById = await listAuthUsersById();
  const facilityRows = (facilities || []) as FacilityRow[];
  const workspaceRows = (workspaceAccess || []) as WorkspaceAccessRow[];

  return {
    employees: ((employees || []) as EmployeeRow[]).map((employee) => {
      const authUser = employee.auth_user_id ? authUsersById.get(employee.auth_user_id) || null : null;
      const status = resolveAccountStatus(employee, authUser, workspaceRows);

      return {
        employeeId: String(employee.id),
        fullName: employee.full_name || 'Chưa đặt tên',
        title: employee.title || null,
        email: employee.email || null,
        employmentStatus: employee.status || null,
        facilityName: resolveFacilityName(employee, facilityRows),
        accountConnectionStatus: status.accountConnectionStatus,
        invitationStatus: status.invitationStatus,
        canEdit: canEditEmployees,
        canManageAccount: canManageAccounts,
      };
    }),
    capabilities: {
      canViewEmployees: true,
      canEditEmployees,
      canManageAccounts,
    },
  };
}

export async function getAdminEmployeeDetailData(employeeId: string): Promise<EmployeeDetailDto> {
  const authContext = await requireAdminEmployeePermission('EMPLOYEE_VIEW');
  const [canEditEmployee, canManageAccount, canViewFinance] = await Promise.all([
    hasPermission(authContext, 'EMPLOYEE_MANAGE'),
    hasPermission(authContext, 'ACCOUNT_MANAGE'),
    hasPermission(authContext, 'FINANCE_VIEW'),
  ]);
  const supabase = await createClient();

  const [
    { data: employee, error: employeeError },
    { data: facilities },
    { data: workspaceAccess },
    { data: permissions },
    { data: projectMemberships },
  ] = await Promise.all([
    supabase
      .from('employees')
      .select('id, full_name, title, email, phone, status, is_active, auth_user_id, branch_code, hourly_rate, created_at')
      .eq('id', employeeId)
      .maybeSingle(),
    supabase.from('facilities').select('id, name, facility_name, code'),
    supabase
      .from('employee_workspace_access')
      .select('employee_id, workspace, status, revoked_at')
      .eq('employee_id', employeeId),
    supabase
      .from('employee_permissions')
      .select('employee_id, permission_code, effect, status, revoked_at')
      .eq('employee_id', employeeId),
    supabase
      .from('project_members')
      .select('project_id, member_role, status, projects(name)')
      .eq('employee_id', employeeId)
      .limit(20),
  ]);

  if (employeeError) {
    throw new AuthFlowError({
      status: 500,
      code: 'admin_verification_failed',
      message: 'Không thể tải hồ sơ nhân sự.',
      failureStage: 'permission_check',
      safeDetails: {
        supabase_error_code: employeeError.code ?? 'unknown',
      },
    });
  }

  if (!employee) {
    throw new AuthFlowError({
      status: 404,
      code: 'employee_not_linked',
      message: 'Không tìm thấy hồ sơ nhân sự.',
      failureStage: 'employee_lookup',
    });
  }

  const employeeRow = employee as EmployeeRow;
  const workspaceRows = (workspaceAccess || []) as WorkspaceAccessRow[];
  const authUsersById = await listAuthUsersById();
  const authUser = employeeRow.auth_user_id ? authUsersById.get(employeeRow.auth_user_id) || null : null;
  const status = resolveAccountStatus(employeeRow, authUser, workspaceRows);
  const activeWorkspaceRows = workspaceRows.filter(
    (row) => row.status === 'ACTIVE' && !row.revoked_at
  );

  return {
    employeeId: String(employeeRow.id),
    fullName: employeeRow.full_name || 'Chưa đặt tên',
    title: employeeRow.title || null,
    email: employeeRow.email || null,
    phone: employeeRow.phone || null,
    employmentStatus: employeeRow.status || null,
    facility: resolveFacilityName(employeeRow, (facilities || []) as FacilityRow[]),
    hourlyRate: canViewFinance || canEditEmployee ? employeeRow.hourly_rate ?? null : null,
    createdAt: employeeRow.created_at || null,
    accountConnectionStatus: status.accountConnectionStatus,
    invitationStatus: status.invitationStatus,
    hasStaffWorkspace: activeWorkspaceRows.some((row) => row.workspace === 'STAFF_WORKSPACE'),
    hasAdminWorkspace: activeWorkspaceRows.some((row) => row.workspace === 'ADMIN_WORKSPACE'),
    permissions: ((permissions || []) as PermissionRow[])
      .filter((row) => row.status === 'ACTIVE' && !row.revoked_at && row.permission_code && row.effect)
      .map((row) => ({
        permissionCode: row.permission_code!,
        effect: row.effect!,
      })),
    projectMemberships: ((projectMemberships || []) as ProjectMembershipRow[]).map((row) => ({
      projectId: String(row.project_id),
      projectName: row.projects?.name || `Dự án ${row.project_id}`,
      memberRole: row.member_role || 'MEMBER',
      status: row.status || 'ACTIVE',
    })),
    capabilities: {
      canEditEmployee,
      canManageAccount,
      canViewCompensation: canViewFinance || canEditEmployee,
    },
  };
}
