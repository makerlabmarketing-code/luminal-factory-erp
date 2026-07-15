import 'server-only';

import { AuthFlowError } from '@/services/server/auth';
import { requireAdminEmployeePermission } from '@/services/server/adminEmployeeData';
import { createSupabaseAdminClient } from '@/utils/supabase/admin';
import {
  AUTH_CALLBACK_PATH,
  buildUpdatePasswordRedirectPath,
  buildAuthRedirectUrl,
  buildPasswordRecoveryRedirectUrl,
  getPublicAppBaseUrl,
} from '@/utils/auth/flow';

interface EmployeeAccountRow {
  id: number | string;
  full_name?: string | null;
  email?: string | null;
  status?: string | null;
  is_active?: boolean | null;
  auth_user_id?: string | null;
}

interface EmployeeMutationInput {
  fullName?: unknown;
  email?: unknown;
  title?: unknown;
  employmentStatus?: unknown;
}

export interface AdminActionResult {
  success: true;
  message: string;
}

function cleanText(value: unknown, maxLength = 160): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
}

function normalizeEmail(value?: string | null): string {
  return (value || '').trim().toLowerCase();
}

function isActiveEmployee(row: EmployeeAccountRow): boolean {
  const status = (row.status || '').trim().toUpperCase();
  return row.is_active !== false && status !== 'INACTIVE' && status !== 'LOCKED';
}

function isMissingTarget(error?: { code?: string } | null): boolean {
  return error?.code === 'PGRST116';
}

function toSafeAuthErrorMessage(message?: string): string {
  const normalized = (message || '').toLowerCase();

  if (normalized.includes('rate') || normalized.includes('too many')) {
    return 'Hệ thống đang giới hạn số lần gửi email. Vui lòng thử lại sau.';
  }

  if (normalized.includes('already') || normalized.includes('registered')) {
    return 'Email này đã tồn tại trong hệ thống tài khoản. Vui lòng kiểm tra liên kết trước khi gửi lại.';
  }

  return 'Không thể thực hiện thao tác tài khoản. Vui lòng thử lại.';
}

async function loadTargetEmployee(employeeId: string): Promise<EmployeeAccountRow> {
  const supabaseAdmin = createSupabaseAdminClient();
  const { data, error } = await supabaseAdmin
    .from('employees')
    .select('id, full_name, email, status, is_active, auth_user_id')
    .eq('id', employeeId)
    .maybeSingle();

  if (error && !isMissingTarget(error)) throw error;
  if (!data) {
    throw new AuthFlowError({
      status: 404,
      code: 'employee_not_linked',
      message: 'Không tìm thấy hồ sơ nhân sự.',
      failureStage: 'employee_lookup',
    });
  }

  return data as EmployeeAccountRow;
}

async function ensureNoDuplicateEmployeeEmail(employee: EmployeeAccountRow): Promise<void> {
  const email = normalizeEmail(employee.email);
  if (!email) return;

  const supabaseAdmin = createSupabaseAdminClient();
  const { data, error } = await supabaseAdmin
    .from('employees')
    .select('id, email')
    .ilike('email', employee.email!.trim());

  if (error) throw error;

  const duplicates = ((data || []) as EmployeeAccountRow[]).filter(
    (row) => String(row.id) !== String(employee.id) && normalizeEmail(row.email) === email
  );

  if (duplicates.length > 0) {
    throw new AuthFlowError({
      status: 409,
      code: 'workspace_forbidden',
      message: 'Email này đang trùng với hồ sơ nhân sự khác.',
      failureStage: 'employee_lookup',
    });
  }
}

async function findAuthUsersByEmail(email: string) {
  const supabaseAdmin = createSupabaseAdminClient();
  const normalizedEmail = normalizeEmail(email);
  const matches = [];
  let page = 1;
  const perPage = 1000;

  while (page < 20) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    matches.push(
      ...(data.users || []).filter((user) => normalizeEmail(user.email) === normalizedEmail)
    );

    if (!data.users || data.users.length < perPage) break;
    page += 1;
  }

  return matches;
}

async function ensureAuthEmailIsUnmapped(employee: EmployeeAccountRow): Promise<void> {
  const email = normalizeEmail(employee.email);
  if (!email) return;

  const matches = await findAuthUsersByEmail(email);
  if (matches.length === 0) return;

  const supabaseAdmin = createSupabaseAdminClient();
  const matchIds = matches.map((user) => user.id);
  const { data, error } = await supabaseAdmin
    .from('employees')
    .select('id, auth_user_id')
    .in('auth_user_id', matchIds);

  if (error) throw error;

  const mappedToOtherEmployee = ((data || []) as EmployeeAccountRow[]).some(
    (row) => String(row.id) !== String(employee.id)
  );

  if (mappedToOtherEmployee) {
    throw new AuthFlowError({
      status: 409,
      code: 'workspace_forbidden',
      message: 'Tài khoản Auth này đã được liên kết với nhân sự khác.',
      failureStage: 'employee_lookup',
    });
  }

  throw new AuthFlowError({
    status: 409,
    code: 'workspace_forbidden',
    message: 'Email này đã tồn tại trong Auth nhưng chưa được liên kết rõ ràng. Vui lòng xử lý thủ công.',
    failureStage: 'employee_lookup',
  });
}

async function ensureAccountActionTarget(employeeId: string, options: { requireEmail: boolean }) {
  await requireAdminEmployeePermission('ACCOUNT_MANAGE');
  const employee = await loadTargetEmployee(employeeId);

  if (!isActiveEmployee(employee)) {
    throw new AuthFlowError({
      status: 403,
      code: 'employee_inactive',
      message: 'Không thể thao tác tài khoản cho nhân sự đã ngừng hoạt động.',
      failureStage: 'employee_status',
    });
  }

  if (options.requireEmail && !normalizeEmail(employee.email)) {
    throw new AuthFlowError({
      status: 400,
      code: 'employee_not_linked',
      message: 'Hồ sơ nhân sự chưa có email.',
      failureStage: 'employee_lookup',
    });
  }

  return employee;
}

export async function inviteEmployee(employeeId: string): Promise<AdminActionResult> {
  const employee = await ensureAccountActionTarget(employeeId, { requireEmail: true });

  if (employee.auth_user_id) {
    return { success: true, message: 'Hồ sơ này đã có tài khoản hệ thống.' };
  }

  await ensureNoDuplicateEmployeeEmail(employee);
  await ensureAuthEmailIsUnmapped(employee);

  const supabaseAdmin = createSupabaseAdminClient();
  const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(employee.email!.trim(), {
    redirectTo: buildAuthRedirectUrl(
      getPublicAppBaseUrl(),
      `${AUTH_CALLBACK_PATH}?mode=invite&next=${encodeURIComponent(buildUpdatePasswordRedirectPath('invite'))}`
    ),
  });

  if (error) {
    throw new AuthFlowError({
      status: 409,
      code: 'workspace_forbidden',
      message: toSafeAuthErrorMessage(error.message),
      failureStage: 'employee_lookup',
    });
  }

  const authUserId = data.user?.id;
  if (!authUserId) {
    throw new AuthFlowError({
      status: 500,
      code: 'admin_verification_failed',
      message: 'Không nhận được thông tin tài khoản sau khi gửi lời mời.',
      failureStage: 'employee_lookup',
    });
  }

  const { error: updateError } = await supabaseAdmin
    .from('employees')
    .update({ auth_user_id: authUserId })
    .eq('id', employee.id)
    .is('auth_user_id', null);

  if (updateError) throw updateError;

  return { success: true, message: 'Đã gửi lời mời kích hoạt tài khoản.' };
}

export async function resendEmployeeInvite(employeeId: string): Promise<AdminActionResult> {
  const employee = await ensureAccountActionTarget(employeeId, { requireEmail: true });
  if (!employee.auth_user_id) return inviteEmployee(employeeId);

  const supabaseAdmin = createSupabaseAdminClient();
  const { error } = await supabaseAdmin.auth.admin.inviteUserByEmail(employee.email!.trim(), {
    redirectTo: buildAuthRedirectUrl(
      getPublicAppBaseUrl(),
      `${AUTH_CALLBACK_PATH}?mode=invite&next=${encodeURIComponent(buildUpdatePasswordRedirectPath('invite'))}`
    ),
  });

  if (error) {
    throw new AuthFlowError({
      status: 409,
      code: 'workspace_forbidden',
      message: toSafeAuthErrorMessage(error.message),
      failureStage: 'employee_lookup',
    });
  }

  return { success: true, message: 'Đã gửi lại lời mời kích hoạt tài khoản.' };
}

export async function sendEmployeePasswordReset(employeeId: string): Promise<AdminActionResult> {
  const employee = await ensureAccountActionTarget(employeeId, { requireEmail: true });
  if (!employee.auth_user_id) {
    throw new AuthFlowError({
      status: 400,
      code: 'employee_not_linked',
      message: 'Hồ sơ này chưa liên kết tài khoản hệ thống.',
      failureStage: 'employee_lookup',
    });
  }

  const supabaseAdmin = createSupabaseAdminClient();
  const { error } = await supabaseAdmin.auth.resetPasswordForEmail(employee.email!.trim(), {
    redirectTo: buildPasswordRecoveryRedirectUrl(getPublicAppBaseUrl()),
  });

  if (error) {
    throw new AuthFlowError({
      status: 409,
      code: 'workspace_forbidden',
      message: toSafeAuthErrorMessage(error.message),
      failureStage: 'employee_lookup',
    });
  }

  return { success: true, message: 'Đã gửi link đặt lại mật khẩu.' };
}

export async function revokeEmployeeAccess(employeeId: string): Promise<AdminActionResult> {
  await requireAdminEmployeePermission('ACCOUNT_MANAGE');
  const employee = await loadTargetEmployee(employeeId);
  const supabaseAdmin = createSupabaseAdminClient();
  const { data, error } = await supabaseAdmin
    .from('employee_workspace_access')
    .update({ status: 'INACTIVE', revoked_at: new Date().toISOString() })
    .eq('employee_id', employee.id)
    .eq('status', 'ACTIVE')
    .is('revoked_at', null)
    .select('id');

  if (error) throw error;

  return {
    success: true,
    message: data && data.length > 0 ? 'Đã thu hồi quyền truy cập.' : 'Quyền truy cập đã được thu hồi trước đó.',
  };
}

export async function restoreEmployeeAccess(employeeId: string): Promise<AdminActionResult> {
  await requireAdminEmployeePermission('ACCOUNT_MANAGE');
  const employee = await loadTargetEmployee(employeeId);
  const supabaseAdmin = createSupabaseAdminClient();
  const { data, error } = await supabaseAdmin
    .from('employee_workspace_access')
    .update({ status: 'ACTIVE', revoked_at: null })
    .eq('employee_id', employee.id)
    .eq('status', 'INACTIVE')
    .not('revoked_at', 'is', null)
    .select('id');

  if (error) throw error;

  if (!data || data.length === 0) {
    throw new AuthFlowError({
      status: 409,
      code: 'workspace_forbidden',
      message: 'Không tìm thấy quyền đã thu hồi để khôi phục.',
      failureStage: 'workspace_access',
    });
  }

  return { success: true, message: 'Đã khôi phục quyền truy cập.' };
}

export async function createEmployee(input: EmployeeMutationInput): Promise<AdminActionResult> {
  await requireAdminEmployeePermission('EMPLOYEE_MANAGE');

  const fullName = cleanText(input.fullName);
  if (!fullName) {
    throw new AuthFlowError({
      status: 400,
      code: 'employee_not_linked',
      message: 'Vui lòng nhập họ tên nhân sự.',
      failureStage: 'employee_lookup',
    });
  }

  const payload = {
    full_name: fullName,
    email: cleanText(input.email),
    title: cleanText(input.title) || 'Nhân sự',
    status: cleanText(input.employmentStatus) || 'ACTIVE',
    role: 'STAFF',
  };
  const supabaseAdmin = createSupabaseAdminClient();
  const { error } = await supabaseAdmin.from('employees').insert([payload]);

  if (error) throw error;

  return { success: true, message: 'Đã tạo hồ sơ nhân sự.' };
}

export async function updateEmployee(employeeId: string, input: EmployeeMutationInput): Promise<AdminActionResult> {
  await requireAdminEmployeePermission('EMPLOYEE_MANAGE');

  const fullName = cleanText(input.fullName);
  if (!fullName) {
    throw new AuthFlowError({
      status: 400,
      code: 'employee_not_linked',
      message: 'Vui lòng nhập họ tên nhân sự.',
      failureStage: 'employee_lookup',
    });
  }

  await loadTargetEmployee(employeeId);

  const payload = {
    full_name: fullName,
    email: cleanText(input.email),
    title: cleanText(input.title) || 'Nhân sự',
    status: cleanText(input.employmentStatus) || 'ACTIVE',
  };
  const supabaseAdmin = createSupabaseAdminClient();
  const { error } = await supabaseAdmin.from('employees').update(payload).eq('id', employeeId);

  if (error) throw error;

  return { success: true, message: 'Đã cập nhật hồ sơ nhân sự.' };
}

export async function deactivateEmployee(employeeId: string): Promise<AdminActionResult> {
  await requireAdminEmployeePermission('EMPLOYEE_MANAGE');
  await loadTargetEmployee(employeeId);

  const supabaseAdmin = createSupabaseAdminClient();
  const { error } = await supabaseAdmin
    .from('employees')
    .update({ status: 'INACTIVE', is_active: false })
    .eq('id', employeeId);

  if (error) throw error;

  return { success: true, message: 'Đã vô hiệu hóa hồ sơ nhân sự.' };
}
