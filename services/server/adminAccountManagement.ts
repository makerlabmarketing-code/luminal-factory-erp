import "server-only";

import { AuthFlowError, type AuthContext } from "@/services/server/auth";
import { requireAdminEmployeePermission } from "@/services/server/adminEmployeeData";
import { createSupabaseAdminClient } from "@/utils/supabase/admin";
import {
  ACCOUNT_PRESETS,
  ALL_PERMISSION_CODES,
  type AccountPresetCode,
  type PermissionCode,
  type PermissionEditorState,
  type PermissionEffect,
  type WorkspaceCode,
  getAccountPreset,
} from "@/lib/account-permissions";

type AccountConnectionStatus =
  | "NOT_CONNECTED"
  | "MISSING_EMAIL"
  | "INVITED"
  | "PENDING_PASSWORD"
  | "CONNECTED"
  | "ACCESS_REVOKED"
  | "LINK_ERROR";

type DetectedPresetCode = AccountPresetCode | "CUSTOM" | "NONE";

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
  id?: number | string;
  employee_id: number | string;
  workspace: string | null;
  status: string | null;
  revoked_at?: string | null;
}

interface PermissionRow {
  id?: number | string;
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

export interface AccountPermissionDto {
  code: PermissionCode;
  state: PermissionEditorState;
  effective: PermissionEditorState;
}

export interface AdminAccountListItem {
  employeeId: string;
  fullName: string;
  email: string | null;
  employmentStatus: string | null;
  accountConnectionStatus: AccountConnectionStatus;
  hasStaffWorkspace: boolean;
  hasAdminWorkspace: boolean;
  presetCode: DetectedPresetCode;
  activePermissionCount: number;
  accessStatus: "ACTIVE" | "REVOKED" | "NO_ACCESS";
  isSelf: boolean;
  isSystemOwner: boolean;
}

export interface AdminAccountDetailDto extends AdminAccountListItem {
  permissions: AccountPermissionDto[];
}

export interface AdminAccountManagementData {
  accounts: AdminAccountListItem[];
  presets: typeof ACCOUNT_PRESETS;
  permissionCodes: PermissionCode[];
}

export interface AdminAccountActionResult {
  success: true;
  message: string;
}

interface UpdateWorkspacesInput {
  staffWorkspace?: unknown;
  adminWorkspace?: unknown;
}

interface UpdatePermissionsInput {
  permissions?: unknown;
}

interface ApplyPresetInput {
  presetCode?: unknown;
}

function normalizeEmail(value?: string | null): string {
  return (value || "").trim().toLowerCase();
}

function isSystemOwner(employee: EmployeeAccountRow): boolean {
  return (employee.role || "").trim().toUpperCase() === "OWNER";
}

function isActiveEmployee(employee: EmployeeAccountRow): boolean {
  const status = (employee.status || "").trim().toUpperCase();

  return (
    employee.is_active !== false && status !== "INACTIVE" && status !== "LOCKED"
  );
}

function isActiveWorkspace(row: WorkspaceAccessRow): boolean {
  return row.status === "ACTIVE" && !row.revoked_at;
}

function isActivePermission(row: PermissionRow): boolean {
  return row.status === "ACTIVE" && !row.revoked_at;
}

function employeeId(authContext: AuthContext): string {
  return String(authContext.employee.id);
}

function hasWorkspace(
  employee: EmployeeAccountRow,
  rows: WorkspaceAccessRow[],
  workspace: WorkspaceCode,
): boolean {
  return rows.some(
    (row) =>
      String(row.employee_id) === String(employee.id) &&
      row.workspace === workspace &&
      isActiveWorkspace(row),
  );
}

function permissionStateFor(
  employee: EmployeeAccountRow,
  rows: PermissionRow[],
  permissionCode: PermissionCode,
): PermissionEditorState {
  const activeRows = rows.filter(
    (row) =>
      String(row.employee_id) === String(employee.id) &&
      row.permission_code === permissionCode &&
      isActivePermission(row),
  );

  if (activeRows.some((row) => row.effect === "DENY")) return "DENY";
  if (activeRows.some((row) => row.effect === "ALLOW")) return "ALLOW";

  return "NONE";
}

function activePermissionCount(
  employee: EmployeeAccountRow,
  rows: PermissionRow[],
): number {
  return ALL_PERMISSION_CODES.filter(
    (permissionCode) =>
      permissionStateFor(employee, rows, permissionCode) === "ALLOW",
  ).length;
}

function detectPreset(
  employee: EmployeeAccountRow,
  workspaceRows: WorkspaceAccessRow[],
  permissionRows: PermissionRow[],
): DetectedPresetCode {
  const activeWorkspaces = new Set<WorkspaceCode>();
  if (hasWorkspace(employee, workspaceRows, "STAFF_WORKSPACE"))
    activeWorkspaces.add("STAFF_WORKSPACE");
  if (hasWorkspace(employee, workspaceRows, "ADMIN_WORKSPACE"))
    activeWorkspaces.add("ADMIN_WORKSPACE");

  const activePermissionStates = new Map<
    PermissionCode,
    PermissionEditorState
  >();
  ALL_PERMISSION_CODES.forEach((permissionCode) => {
    activePermissionStates.set(
      permissionCode,
      permissionStateFor(employee, permissionRows, permissionCode),
    );
  });

  const matchedPreset = ACCOUNT_PRESETS.filter(
    (preset) => preset.code !== "CUSTOM",
  ).find((preset) => {
    if (preset.workspaces.length !== activeWorkspaces.size) return false;
    if (
      !preset.workspaces.every((workspace) => activeWorkspaces.has(workspace))
    )
      return false;

    const presetPermissions = new Set(preset.permissions);

    return ALL_PERMISSION_CODES.every((permissionCode) => {
      const expectedState = presetPermissions.has(permissionCode)
        ? "ALLOW"
        : "NONE";
      return activePermissionStates.get(permissionCode) === expectedState;
    });
  });

  if (matchedPreset) return matchedPreset.code;
  if (
    activeWorkspaces.size === 0 &&
    activePermissionCount(employee, permissionRows) === 0
  )
    return "NONE";

  return "CUSTOM";
}

function resolveAccountStatus(
  employee: EmployeeAccountRow,
  authUser: AuthUserSummary | null,
  workspaceRows: WorkspaceAccessRow[],
): AccountConnectionStatus {
  if (!employee.auth_user_id && !normalizeEmail(employee.email))
    return "MISSING_EMAIL";
  if (!employee.auth_user_id) return "NOT_CONNECTED";
  if (!authUser) return "LINK_ERROR";
  if (authUser.banned_until) return "ACCESS_REVOKED";
  if (
    !hasWorkspace(employee, workspaceRows, "STAFF_WORKSPACE") &&
    !hasWorkspace(employee, workspaceRows, "ADMIN_WORKSPACE")
  ) {
    return "ACCESS_REVOKED";
  }

  const confirmed = Boolean(
    authUser.confirmed_at || authUser.email_confirmed_at,
  );
  if (!confirmed && authUser.invited_at) return "INVITED";
  if (!authUser.last_sign_in_at) return "PENDING_PASSWORD";

  return "CONNECTED";
}

function toAccountListItem(
  employee: EmployeeAccountRow,
  authUser: AuthUserSummary | null,
  workspaceRows: WorkspaceAccessRow[],
  permissionRows: PermissionRow[],
  actorEmployeeId: string,
): AdminAccountListItem {
  const hasStaffWorkspace = hasWorkspace(
    employee,
    workspaceRows,
    "STAFF_WORKSPACE",
  );
  const hasAdminWorkspace = hasWorkspace(
    employee,
    workspaceRows,
    "ADMIN_WORKSPACE",
  );
  const permissionCount = activePermissionCount(employee, permissionRows);
  const accessStatus =
    hasStaffWorkspace || hasAdminWorkspace || permissionCount > 0
      ? "ACTIVE"
      : employee.auth_user_id
        ? "REVOKED"
        : "NO_ACCESS";

  return {
    employeeId: String(employee.id),
    fullName: employee.full_name || "Chưa đặt tên",
    email: employee.email || null,
    employmentStatus: employee.status || null,
    accountConnectionStatus: resolveAccountStatus(
      employee,
      authUser,
      workspaceRows,
    ),
    hasStaffWorkspace,
    hasAdminWorkspace,
    presetCode: detectPreset(employee, workspaceRows, permissionRows),
    activePermissionCount: permissionCount,
    accessStatus,
    isSelf: String(employee.id) === actorEmployeeId,
    isSystemOwner: isSystemOwner(employee),
  };
}

async function listAuthUsersById(): Promise<Map<string, AuthUserSummary>> {
  const supabaseAdmin = createSupabaseAdminClient();
  const users = new Map<string, AuthUserSummary>();
  let page = 1;
  const perPage = 1000;

  while (page < 20) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage,
    });
    if (error) throw error;

    (data.users || []).forEach((user) => {
      users.set(user.id, user as AuthUserSummary);
    });

    if (!data.users || data.users.length < perPage) break;
    page += 1;
  }

  return users;
}

async function loadAccountRows() {
  const supabaseAdmin = createSupabaseAdminClient();
  const [
    { data: employees, error: employeeError },
    { data: workspaceRows, error: workspaceError },
    { data: permissionRows, error: permissionError },
  ] = await Promise.all([
    supabaseAdmin
      .from("employees")
      .select("id, full_name, email, status, role, is_active, auth_user_id")
      .order("id", { ascending: false }),
    supabaseAdmin
      .from("employee_workspace_access")
      .select("id, employee_id, workspace, status, revoked_at"),
    supabaseAdmin
      .from("employee_permissions")
      .select("id, employee_id, permission_code, effect, status, revoked_at"),
  ]);

  if (employeeError || workspaceError || permissionError) {
    throw new AuthFlowError({
      status: 500,
      code: "admin_verification_failed",
      message: "Không thể tải dữ liệu tài khoản.",
      failureStage: "permission_check",
      safeDetails: {
        supabase_error_code:
          employeeError?.code ||
          workspaceError?.code ||
          permissionError?.code ||
          "unknown",
      },
    });
  }

  return {
    employees: (employees || []) as EmployeeAccountRow[],
    workspaceRows: (workspaceRows || []) as WorkspaceAccessRow[],
    permissionRows: (permissionRows || []) as PermissionRow[],
  };
}

async function loadTargetEmployee(
  employeeIdValue: string,
): Promise<EmployeeAccountRow> {
  const supabaseAdmin = createSupabaseAdminClient();
  const { data, error } = await supabaseAdmin
    .from("employees")
    .select("id, full_name, email, status, role, is_active, auth_user_id")
    .eq("id", employeeIdValue)
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    throw new AuthFlowError({
      status: 404,
      code: "employee_not_linked",
      message: "Không tìm thấy hồ sơ nhân sự.",
      failureStage: "employee_lookup",
    });
  }

  return data as EmployeeAccountRow;
}

function isAdministrator(
  employee: EmployeeAccountRow,
  workspaceRows: WorkspaceAccessRow[],
  permissionRows: PermissionRow[],
): boolean {
  return (
    isActiveEmployee(employee) &&
    hasWorkspace(employee, workspaceRows, "ADMIN_WORKSPACE") &&
    permissionStateFor(employee, permissionRows, "ACCOUNT_MANAGE") === "ALLOW"
  );
}

async function assertCanMutateTarget(
  target: EmployeeAccountRow,
  actorId: string,
) {
  if (isSystemOwner(target)) {
    throw new AuthFlowError({
      status: 403,
      code: "workspace_forbidden",
      message: "Tài khoản Chủ sở hữu hệ thống cần quy trình bảo vệ riêng.",
      failureStage: "permission_check",
    });
  }

  if (String(target.id) === actorId) {
    throw new AuthFlowError({
      status: 409,
      code: "workspace_forbidden",
      message:
        "Bạn không thể tự thay đổi quyền truy cập của chính mình trong màn hình này.",
      failureStage: "permission_check",
    });
  }
}

async function assertNotRemovingLastAdministrator(
  targetEmployeeId: string,
  nextWorkspaceRows: WorkspaceAccessRow[],
  nextPermissionRows: PermissionRow[],
) {
  const { employees } = await loadAccountRows();
  const remainingAdministrators = employees.filter((employee) =>
    String(employee.id) === targetEmployeeId
      ? isAdministrator(employee, nextWorkspaceRows, nextPermissionRows)
      : isAdministrator(employee, nextWorkspaceRows, nextPermissionRows),
  );

  if (remainingAdministrators.length === 0) {
    throw new AuthFlowError({
      status: 409,
      code: "workspace_forbidden",
      message: "Không thể xóa quản trị viên cuối cùng.",
      failureStage: "permission_check",
    });
  }
}

function makeNextWorkspaceRows(
  rows: WorkspaceAccessRow[],
  targetEmployeeId: string,
  desiredWorkspaces: WorkspaceCode[],
): WorkspaceAccessRow[] {
  const desired = new Set(desiredWorkspaces);
  const nextRows = rows.filter(
    (row) => String(row.employee_id) !== targetEmployeeId,
  );

  desired.forEach((workspace) => {
    nextRows.push({
      employee_id: targetEmployeeId,
      workspace,
      status: "ACTIVE",
      revoked_at: null,
    });
  });

  return nextRows;
}

function makeNextPermissionRows(
  rows: PermissionRow[],
  targetEmployeeId: string,
  desiredPermissions: Map<PermissionCode, PermissionEditorState>,
): PermissionRow[] {
  const nextRows = rows.filter(
    (row) => String(row.employee_id) !== targetEmployeeId,
  );

  desiredPermissions.forEach((state, permissionCode) => {
    if (state === "NONE") return;

    nextRows.push({
      employee_id: targetEmployeeId,
      permission_code: permissionCode,
      effect: state,
      status: "ACTIVE",
      revoked_at: null,
    });
  });

  return nextRows;
}

async function grantWorkspace(
  targetEmployeeId: string,
  workspace: WorkspaceCode,
  actorEmployeeId: string,
) {
  const supabaseAdmin = createSupabaseAdminClient();
  const { data: activeRows, error: activeError } = await supabaseAdmin
    .from("employee_workspace_access")
    .select("id")
    .eq("employee_id", targetEmployeeId)
    .eq("workspace", workspace)
    .eq("status", "ACTIVE")
    .is("revoked_at", null)
    .order("id", { ascending: true });

  if (activeError) throw activeError;
  if (activeRows && activeRows.length > 0) {
    const duplicateIds = activeRows
      .slice(1)
      .flatMap((row) => (row.id ? [row.id] : []));
    if (duplicateIds.length > 0) {
      const { error: duplicateRevokeError } = await supabaseAdmin
        .from("employee_workspace_access")
        .update({ status: "INACTIVE", revoked_at: new Date().toISOString() })
        .in("id", duplicateIds);

      if (duplicateRevokeError) throw duplicateRevokeError;
    }

    return;
  }

  const { error } = await supabaseAdmin
    .from("employee_workspace_access")
    .insert({
      employee_id: targetEmployeeId,
      workspace,
      status: "ACTIVE",
      granted_by_employee_id: actorEmployeeId,
    });

  if (error) throw error;
}

async function revokeWorkspace(
  targetEmployeeId: string,
  workspace: WorkspaceCode,
) {
  const supabaseAdmin = createSupabaseAdminClient();
  const { error } = await supabaseAdmin
    .from("employee_workspace_access")
    .update({ status: "INACTIVE", revoked_at: new Date().toISOString() })
    .eq("employee_id", targetEmployeeId)
    .eq("workspace", workspace)
    .eq("status", "ACTIVE")
    .is("revoked_at", null);

  if (error) throw error;
}

async function setPermissionState(
  targetEmployeeId: string,
  permissionCode: PermissionCode,
  state: PermissionEditorState,
  actorEmployeeId: string,
) {
  const supabaseAdmin = createSupabaseAdminClient();
  const effectsToRevoke: PermissionEffect[] =
    state === "ALLOW"
      ? ["DENY"]
      : state === "DENY"
        ? ["ALLOW"]
        : ["ALLOW", "DENY"];

  const { error: revokeError } = await supabaseAdmin
    .from("employee_permissions")
    .update({ status: "INACTIVE", revoked_at: new Date().toISOString() })
    .eq("employee_id", targetEmployeeId)
    .eq("permission_code", permissionCode)
    .in("effect", effectsToRevoke)
    .eq("status", "ACTIVE")
    .is("revoked_at", null);

  if (revokeError) throw revokeError;
  if (state === "NONE") return;

  const { data: activeRows, error: activeError } = await supabaseAdmin
    .from("employee_permissions")
    .select("id")
    .eq("employee_id", targetEmployeeId)
    .eq("permission_code", permissionCode)
    .eq("effect", state)
    .eq("status", "ACTIVE")
    .is("revoked_at", null)
    .order("id", { ascending: true });

  if (activeError) throw activeError;
  if (activeRows && activeRows.length > 0) {
    const duplicateIds = activeRows
      .slice(1)
      .flatMap((row) => (row.id ? [row.id] : []));
    if (duplicateIds.length > 0) {
      const { error: duplicateRevokeError } = await supabaseAdmin
        .from("employee_permissions")
        .update({ status: "INACTIVE", revoked_at: new Date().toISOString() })
        .in("id", duplicateIds);

      if (duplicateRevokeError) throw duplicateRevokeError;
    }

    return;
  }

  const { error } = await supabaseAdmin.from("employee_permissions").insert({
    employee_id: targetEmployeeId,
    permission_code: permissionCode,
    effect: state,
    status: "ACTIVE",
    granted_by_employee_id: actorEmployeeId,
  });

  if (error) throw error;
}

function parseBoolean(value: unknown): boolean | null {
  if (typeof value !== "boolean") return null;

  return value;
}

function parsePermissionState(value: unknown): PermissionEditorState | null {
  return value === "ALLOW" || value === "DENY" || value === "NONE"
    ? value
    : null;
}

async function requireAccountManager(): Promise<AuthContext> {
  return requireAdminEmployeePermission("ACCOUNT_MANAGE");
}

export async function getAdminAccountManagementData(): Promise<AdminAccountManagementData> {
  const authContext = await requireAccountManager();
  const { employees, workspaceRows, permissionRows } = await loadAccountRows();
  const authUsersById = await listAuthUsersById();

  return {
    accounts: employees.map((employee) =>
      toAccountListItem(
        employee,
        employee.auth_user_id
          ? authUsersById.get(employee.auth_user_id) || null
          : null,
        workspaceRows,
        permissionRows,
        employeeId(authContext),
      ),
    ),
    presets: ACCOUNT_PRESETS,
    permissionCodes: ALL_PERMISSION_CODES,
  };
}

export async function getAdminAccountDetailData(
  employeeIdValue: string,
): Promise<AdminAccountDetailDto> {
  const authContext = await requireAccountManager();
  const target = await loadTargetEmployee(employeeIdValue);
  const { workspaceRows, permissionRows } = await loadAccountRows();
  const authUsersById = await listAuthUsersById();
  const account = toAccountListItem(
    target,
    target.auth_user_id ? authUsersById.get(target.auth_user_id) || null : null,
    workspaceRows,
    permissionRows,
    employeeId(authContext),
  );

  return {
    ...account,
    permissions: ALL_PERMISSION_CODES.map((permissionCode) => {
      const state = permissionStateFor(target, permissionRows, permissionCode);

      return {
        code: permissionCode,
        state,
        effective: state,
      };
    }),
  };
}

export async function updateAccountWorkspaces(
  targetEmployeeId: string,
  input: UpdateWorkspacesInput,
): Promise<AdminAccountActionResult> {
  const authContext = await requireAccountManager();
  const target = await loadTargetEmployee(targetEmployeeId);
  await assertCanMutateTarget(target, employeeId(authContext));

  const staffWorkspace = parseBoolean(input.staffWorkspace);
  const adminWorkspace = parseBoolean(input.adminWorkspace);
  if (staffWorkspace === null || adminWorkspace === null) {
    throw new AuthFlowError({
      status: 400,
      code: "employee_not_linked",
      message: "Dữ liệu workspace không hợp lệ.",
      failureStage: "permission_check",
    });
  }

  const { workspaceRows, permissionRows } = await loadAccountRows();
  const desiredWorkspaces: WorkspaceCode[] = [];
  if (staffWorkspace) desiredWorkspaces.push("STAFF_WORKSPACE");
  if (adminWorkspace) desiredWorkspaces.push("ADMIN_WORKSPACE");
  const hasWorkspaceChanges =
    hasWorkspace(target, workspaceRows, "STAFF_WORKSPACE") !== staffWorkspace ||
    hasWorkspace(target, workspaceRows, "ADMIN_WORKSPACE") !== adminWorkspace;
  if (!hasWorkspaceChanges) {
    throw new AuthFlowError({
      status: 409,
      code: "workspace_forbidden",
      message: "Không có thay đổi workspace nào để lưu.",
      failureStage: "permission_check",
    });
  }

  const nextWorkspaceRows = makeNextWorkspaceRows(
    workspaceRows,
    targetEmployeeId,
    desiredWorkspaces,
  );

  await assertNotRemovingLastAdministrator(
    targetEmployeeId,
    nextWorkspaceRows,
    permissionRows,
  );

  if (staffWorkspace)
    await grantWorkspace(
      targetEmployeeId,
      "STAFF_WORKSPACE",
      employeeId(authContext),
    );
  else await revokeWorkspace(targetEmployeeId, "STAFF_WORKSPACE");

  if (adminWorkspace)
    await grantWorkspace(
      targetEmployeeId,
      "ADMIN_WORKSPACE",
      employeeId(authContext),
    );
  else await revokeWorkspace(targetEmployeeId, "ADMIN_WORKSPACE");

  return { success: true, message: "Đã cập nhật workspace." };
}

export async function updateAccountPermissions(
  targetEmployeeId: string,
  input: UpdatePermissionsInput,
): Promise<AdminAccountActionResult> {
  const authContext = await requireAccountManager();
  const target = await loadTargetEmployee(targetEmployeeId);
  await assertCanMutateTarget(target, employeeId(authContext));
  const permissionPayload = input.permissions;

  if (
    !permissionPayload ||
    typeof permissionPayload !== "object" ||
    Array.isArray(permissionPayload)
  ) {
    throw new AuthFlowError({
      status: 400,
      code: "employee_not_linked",
      message: "Dữ liệu permission không hợp lệ.",
      failureStage: "permission_check",
    });
  }

  const payloadKeys = Object.keys(permissionPayload as Record<string, unknown>);
  const unknownKeys = payloadKeys.filter(
    (key) => !ALL_PERMISSION_CODES.includes(key as PermissionCode),
  );
  if (unknownKeys.length > 0) {
    throw new AuthFlowError({
      status: 400,
      code: "employee_not_linked",
      message: "Dữ liệu permission có quyền không hợp lệ.",
      failureStage: "permission_check",
    });
  }

  const desiredPermissions = new Map<PermissionCode, PermissionEditorState>();
  for (const permissionCode of ALL_PERMISSION_CODES) {
    const state = parsePermissionState(
      (permissionPayload as Record<string, unknown>)[permissionCode],
    );
    if (!state) {
      throw new AuthFlowError({
        status: 400,
        code: "employee_not_linked",
        message: "Dữ liệu permission không hợp lệ.",
        failureStage: "permission_check",
      });
    }
    desiredPermissions.set(permissionCode, state);
  }

  const { workspaceRows, permissionRows } = await loadAccountRows();
  const hasChanges = ALL_PERMISSION_CODES.some(
    (permissionCode) =>
      permissionStateFor(target, permissionRows, permissionCode) !==
      desiredPermissions.get(permissionCode),
  );
  if (!hasChanges) {
    throw new AuthFlowError({
      status: 409,
      code: "workspace_forbidden",
      message: "Không có thay đổi quyền nào để lưu.",
      failureStage: "permission_check",
    });
  }
  const nextPermissionRows = makeNextPermissionRows(
    permissionRows,
    targetEmployeeId,
    desiredPermissions,
  );
  await assertNotRemovingLastAdministrator(
    targetEmployeeId,
    workspaceRows,
    nextPermissionRows,
  );

  for (const [permissionCode, state] of Array.from(
    desiredPermissions.entries(),
  )) {
    await setPermissionState(
      targetEmployeeId,
      permissionCode,
      state,
      employeeId(authContext),
    );
  }

  return { success: true, message: "Đã cập nhật permissions." };
}

export async function applyAccountPreset(
  targetEmployeeId: string,
  input: ApplyPresetInput,
): Promise<AdminAccountActionResult> {
  const authContext = await requireAccountManager();
  const target = await loadTargetEmployee(targetEmployeeId);
  await assertCanMutateTarget(target, employeeId(authContext));
  const presetCode =
    typeof input.presetCode === "string" ? input.presetCode : "";
  const preset = getAccountPreset(presetCode);

  if (!preset) {
    throw new AuthFlowError({
      status: 400,
      code: "employee_not_linked",
      message: "Preset không hợp lệ.",
      failureStage: "permission_check",
    });
  }

  const desiredPermissionMap = new Map<PermissionCode, PermissionEditorState>();
  const presetPermissions = new Set(preset.permissions);
  ALL_PERMISSION_CODES.forEach((permissionCode) => {
    desiredPermissionMap.set(
      permissionCode,
      presetPermissions.has(permissionCode) ? "ALLOW" : "NONE",
    );
  });

  const { workspaceRows, permissionRows } = await loadAccountRows();
  const hasChanges = ALL_PERMISSION_CODES.some(
    (permissionCode) =>
      permissionStateFor(target, permissionRows, permissionCode) !==
      desiredPermissionMap.get(permissionCode),
  );
  if (!hasChanges) {
    throw new AuthFlowError({
      status: 409,
      code: "workspace_forbidden",
      message: "Preset không tạo thay đổi quyền nào.",
      failureStage: "permission_check",
    });
  }
  const nextPermissionRows = makeNextPermissionRows(
    permissionRows,
    targetEmployeeId,
    desiredPermissionMap,
  );
  await assertNotRemovingLastAdministrator(
    targetEmployeeId,
    workspaceRows,
    nextPermissionRows,
  );

  for (const [permissionCode, state] of Array.from(
    desiredPermissionMap.entries(),
  )) {
    await setPermissionState(
      targetEmployeeId,
      permissionCode,
      state,
      employeeId(authContext),
    );
  }

  return { success: true, message: "Đã áp dụng preset." };
}

export async function revokeAccountAccess(
  targetEmployeeId: string,
): Promise<AdminAccountActionResult> {
  const authContext = await requireAccountManager();
  const target = await loadTargetEmployee(targetEmployeeId);
  await assertCanMutateTarget(target, employeeId(authContext));
  const { workspaceRows, permissionRows } = await loadAccountRows();
  const nextWorkspaceRows = makeNextWorkspaceRows(
    workspaceRows,
    targetEmployeeId,
    [],
  );
  const desiredPermissionMap = new Map<PermissionCode, PermissionEditorState>();
  ALL_PERMISSION_CODES.forEach((permissionCode) =>
    desiredPermissionMap.set(permissionCode, "NONE"),
  );
  const nextPermissionRows = makeNextPermissionRows(
    permissionRows,
    targetEmployeeId,
    desiredPermissionMap,
  );

  await assertNotRemovingLastAdministrator(
    targetEmployeeId,
    nextWorkspaceRows,
    nextPermissionRows,
  );

  await revokeWorkspace(targetEmployeeId, "STAFF_WORKSPACE");
  await revokeWorkspace(targetEmployeeId, "ADMIN_WORKSPACE");
  for (const permissionCode of ALL_PERMISSION_CODES) {
    await setPermissionState(
      targetEmployeeId,
      permissionCode,
      "NONE",
      employeeId(authContext),
    );
  }

  return { success: true, message: "Đã thu hồi toàn bộ quyền truy cập." };
}
