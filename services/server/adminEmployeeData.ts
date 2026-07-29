import 'server-only';

import { createClient } from '@/utils/supabase/server';
import { createSupabaseAdminClient } from '@/utils/supabase/admin';
import {
  AuthFlowError,
  hasPermission,
  requireWorkspaceAccess,
  type AuthContext,
} from '@/services/server/auth';
import { findFacility, loadFacilityDirectory, type FacilityDirectoryItem } from '@/services/server/facilityDirectory';
import { resolveEmployeeFacility, type FacilityResolutionStatus } from '@/lib/employeeFacility';
import { accountConnectionExplanations, resolveAccountConnectionStatus, type AccountConnectionStatus } from '@/lib/accountConnection';
import { loadAttendanceData } from '@/services/server/attendanceData';
import { businessDateFromInstant, formatBusinessDateInput } from '@/lib/business-date';

export type { AccountConnectionStatus } from '@/lib/accountConnection';

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
  phone: string | null;
  employmentStatus: string | null;
  facilityName: string | null;
  facilityId: string | null;
  facilityCode: string | null;
  facilityDisplayName: string;
  facilityResolutionStatus: FacilityResolutionStatus;
  accountConnectionStatus: AccountConnectionStatus;
  accountConnectionExplanation: string;
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
  role?: string | null;
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
  email?: string | null;
  invited_at?: string;
  confirmation_sent_at?: string;
  confirmed_at?: string;
  email_confirmed_at?: string;
  last_sign_in_at?: string;
  banned_until?: string;
}

export interface AdminEmployeeListData {
  employees: EmployeeListItem[];
  facilities: FacilityDirectoryItem[];
  capabilities: {
    canViewEmployees: boolean;
    canEditEmployees: boolean;
    canManageAccounts: boolean;
  };
  warnings: Array<'employee_enrichment_failed'>;
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

export interface EmployeeTaskSummary {
  taskId: string;
  projectId: string;
  title: string;
  status: string;
  deadline: string | null;
}

export interface EmployeeAttendanceSummary {
  attendanceId: string;
  workDate: string;
  shiftName: string;
  status: string | null;
  workedHours: number | string | null;
}

export interface EmployeeDetailDto {
  employeeId: string;
  fullName: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  employmentStatus: string | null;
  facility: string | null;
  facilityCode: string | null;
  facilities: FacilityDirectoryItem[];
  hourlyRate: number | string | null;
  bankName: string | null;
  bankAccountNumber: string | null;
  createdAt: string | null;
  accountConnectionStatus: AccountConnectionStatus;
  invitationStatus: InvitationStatus;
  hasStaffWorkspace: boolean;
  hasAdminWorkspace: boolean;
  permissions: EmployeePermissionSummary[];
  projectMemberships: EmployeeProjectMembershipSummary[];
  activeTasks: EmployeeTaskSummary[];
  attendanceHistory: EmployeeAttendanceSummary[];
  assignedRole: string | null;
  warnings: Array<'employee_facility_enrichment_failed' | 'account_lookup_failed' | 'employee_access_enrichment_failed' | 'employee_tasks_enrichment_failed' | 'employee_attendance_enrichment_failed'>;
  capabilities: {
    canEditEmployee: boolean;
    canManageAccount: boolean;
    canViewCompensation: boolean;
    canEditPersonalFinance: boolean;
  };
}

function normalizeText(value?: string | null): string {
  return (value || '').trim();
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
  workspaceRows: WorkspaceAccessRow[],
  options?: { authLookupFailed?: boolean; duplicateMapping?: boolean }
): Pick<EmployeeListItem, 'accountConnectionStatus' | 'invitationStatus'> {
  const accountConnectionStatus = resolveAccountConnectionStatus({
    employeeEmail: employee.email,
    authUserId: employee.auth_user_id,
    employeeIsActive: employee.is_active !== false && normalizeText(employee.status).toUpperCase() !== 'INACTIVE',
    authLookupFailed: options?.authLookupFailed,
    duplicateMapping: options?.duplicateMapping,
    accessRevoked: isAccessRevoked(employee, workspaceRows),
    authUser: authUser ? {
      email: authUser.email,
      invitedAt: authUser.invited_at,
      confirmedAt: authUser.confirmed_at || authUser.email_confirmed_at,
      lastSignInAt: authUser.last_sign_in_at,
      bannedUntil: authUser.banned_until,
    } : null,
  });
  const invitationStatus: InvitationStatus =
    accountConnectionStatus === 'NOT_CONNECTED' ? 'READY_TO_INVITE'
      : accountConnectionStatus === 'INVITED' ? 'INVITED'
        : accountConnectionStatus === 'PENDING_PASSWORD' ? 'PENDING_PASSWORD'
          : accountConnectionStatus === 'ACCESS_REVOKED' ? 'REVOKED'
            : ['AUTH_USER_MISSING', 'AUTH_EMAIL_MISMATCH', 'DUPLICATE_AUTH_MAPPING'].includes(accountConnectionStatus) ? 'ERROR' : 'NONE';
  return { accountConnectionStatus, invitationStatus };
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

  const [{ data: employees, error: employeeError }, facilityResult, workspaceResult] =
    await Promise.all([
      supabase
        .from('employees')
        .select('id, full_name, title, email, phone, status, is_active, auth_user_id, branch_code')
        .order('id', { ascending: false }),
      loadFacilityDirectory(supabase).then(
        ({ facilities }) => ({ facilities, failed: false as const }),
        () => ({ facilities: [] as FacilityDirectoryItem[], failed: true as const })
      ),
      supabase
        .from('employee_workspace_access')
        .select('employee_id, workspace, status, revoked_at')
        .then(({ data, error }) => ({ data: error ? [] : data, failed: Boolean(error) })),
    ]);

  if (employeeError) {
    throw new AuthFlowError({
      status: 500,
      code: 'employee_list_load_failed',
      message: 'Không thể tải danh sách nhân sự.',
      failureStage: 'persistence',
      safeDetails: {
        supabase_error_code: employeeError.code ?? 'unknown',
      },
    });
  }

  const authUsersById = listAuthUsersById();
  const authResult = await authUsersById.then(
    (users) => ({ users, failed: false as const }),
    () => ({ users: new Map<string, AuthUserSummary>(), failed: true as const })
  );
  const facilities = facilityResult.facilities;
  const workspaceRows = (workspaceResult.data || []) as WorkspaceAccessRow[];
  const authMappingCounts = new Map<string, number>();
  ((employees || []) as EmployeeRow[]).forEach((employee) => {
    if (employee.auth_user_id) authMappingCounts.set(employee.auth_user_id, (authMappingCounts.get(employee.auth_user_id) || 0) + 1);
  });

  return {
    employees: ((employees || []) as EmployeeRow[]).map((employee) => {
      const authUser = employee.auth_user_id ? authResult.users.get(employee.auth_user_id) || null : null;
      const status = resolveAccountStatus(employee, authUser, workspaceRows, {
        authLookupFailed: authResult.failed,
        duplicateMapping: Boolean(employee.auth_user_id && (authMappingCounts.get(employee.auth_user_id) || 0) > 1),
      });
      const facility = resolveEmployeeFacility(employee.branch_code, facilities, !facilityResult.failed);

      return {
        employeeId: String(employee.id),
        fullName: employee.full_name || 'Chưa đặt tên',
        title: employee.title || null,
        email: employee.email || null,
        phone: employee.phone || null,
        employmentStatus: employee.status || null,
        facilityName: facility.facilityName,
        facilityId: facility.facilityId,
        facilityCode: facility.facilityCode,
        facilityDisplayName: facility.facilityDisplayName,
        facilityResolutionStatus: facility.facilityResolutionStatus,
        accountConnectionStatus: status.accountConnectionStatus,
        accountConnectionExplanation: accountConnectionExplanations[status.accountConnectionStatus],
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
    facilities,
    warnings:
      facilityResult.failed || workspaceResult.failed || authResult.failed
        ? ['employee_enrichment_failed']
        : [],
  };
}

export async function getAdminEmployeeDetailData(employeeId: string): Promise<EmployeeDetailDto> {
  if (!/^\d+$/.test(employeeId)) {
    throw new AuthFlowError({ status: 400, code: 'employee_lookup_failed', message: 'Mã nhân sự không hợp lệ.', failureStage: 'employee_lookup' });
  }
  const authContext = await requireAdminEmployeePermission('EMPLOYEE_VIEW');
  const [canEditEmployee, canManageAccount, canViewFinance] = await Promise.all([
    hasPermission(authContext, 'EMPLOYEE_MANAGE'),
    hasPermission(authContext, 'ACCOUNT_MANAGE'),
    hasPermission(authContext, 'FINANCE_VIEW'),
  ]);
  const supabase = await createClient();

  const { data: employee, error: employeeError } = await supabase
    .from('employees')
    .select('id, full_name, title, email, phone, status, is_active, auth_user_id, branch_code, hourly_rate, bank_name, bank_account_number, role, created_at')
    .eq('id', employeeId)
    .maybeSingle();

  if (employeeError) {
    throw new AuthFlowError({
      status: 500,
      code: 'employee_detail_load_failed',
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
  const [facilityResult, workspaceResult, permissionResult, membershipResult, taskResult, attendanceResult, authResult] = await Promise.all([
    loadFacilityDirectory(supabase).then(({ facilities }) => ({ data: facilities, failed: false as const }), () => ({ data: [] as FacilityDirectoryItem[], failed: true as const })),
    supabase.from('employee_workspace_access').select('employee_id, workspace, status, revoked_at').eq('employee_id', employeeId).then(({ data, error }) => ({ data: error ? [] : data, failed: Boolean(error) })),
    supabase.from('employee_permissions').select('employee_id, permission_code, effect, status, revoked_at').eq('employee_id', employeeId).then(({ data, error }) => ({ data: error ? [] : data, failed: Boolean(error) })),
    supabase.from('project_members').select('project_id, member_role, status, projects(name)').eq('employee_id', employeeId).limit(20).then(({ data, error }) => ({ data: error ? [] : data, failed: Boolean(error) })),
    supabase.from('tasks').select('id, project_id, title, status, deadline').eq('assignee_employee_id', employeeId).neq('status', 'COMPLETED').order('deadline', { ascending: true }).limit(20).then(({ data, error }) => ({ data: error ? [] : data, failed: Boolean(error) })),
    loadAttendanceData({ monthInput: formatBusinessDateInput(businessDateFromInstant(new Date())).slice(0, 7), employeeId, includeDirectory: false }).then((data) => ({ data: data.attendanceRecords.slice(0, 20), failed: false as const }), () => ({ data: [], failed: true as const })),
    listAuthUsersById().then((data) => ({ data, failed: false as const }), () => ({ data: new Map<string, AuthUserSummary>(), failed: true as const })),
  ]);
  const facilities = facilityResult.data;
  const workspaceAccess = workspaceResult.data;
  const permissions = permissionResult.data;
  const projectMemberships = membershipResult.data;
  const workspaceRows = (workspaceAccess || []) as WorkspaceAccessRow[];
  const authUser = employeeRow.auth_user_id ? authResult.data.get(employeeRow.auth_user_id) || null : null;
  const status = resolveAccountStatus(employeeRow, authUser, workspaceRows, { authLookupFailed: authResult.failed });
  const resolvedFacility = resolveEmployeeFacility(employeeRow.branch_code, facilities, !facilityResult.failed);
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
    facility: resolvedFacility.facilityDisplayName,
    facilityCode: findFacility(facilities, employeeRow.branch_code)?.code || resolvedFacility.facilityCode,
    facilities,
    hourlyRate: canViewFinance ? employeeRow.hourly_rate ?? null : null,
    bankName: canViewFinance ? (employee as { bank_name?: string | null }).bank_name ?? null : null,
    bankAccountNumber: canViewFinance ? (employee as { bank_account_number?: string | null }).bank_account_number ?? null : null,
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
    activeTasks: ((taskResult.data || []) as Array<{ id: number | string; project_id: number | string; title?: string | null; status?: string | null; deadline?: string | null }>).map((row) => ({
      taskId: String(row.id), projectId: String(row.project_id), title: row.title || `Công việc ${row.id}`,
      status: row.status || 'PENDING', deadline: row.deadline || null,
    })),
    attendanceHistory: attendanceResult.data.map((row) => ({ attendanceId: String(row.id), workDate: row.work_date, shiftName: row.shift_name, status: row.status || null, workedHours: row.total_hours ?? null })),
    assignedRole: employeeRow.role || null,
    warnings: [
      ...(facilityResult.failed ? ['employee_facility_enrichment_failed' as const] : []),
      ...(authResult.failed ? ['account_lookup_failed' as const] : []),
      ...(workspaceResult.failed || permissionResult.failed || membershipResult.failed ? ['employee_access_enrichment_failed' as const] : []),
      ...(taskResult.failed ? ['employee_tasks_enrichment_failed' as const] : []),
      ...(attendanceResult.failed ? ['employee_attendance_enrichment_failed' as const] : []),
    ],
    capabilities: {
      canEditEmployee,
      canManageAccount,
      canViewCompensation: canViewFinance,
      canEditPersonalFinance: canViewFinance && canEditEmployee,
    },
  };
}
