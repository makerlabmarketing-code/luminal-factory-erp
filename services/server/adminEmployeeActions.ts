import 'server-only';

import { AuthFlowError, type AuthFailureStage, type AuthFlowErrorCode } from '@/services/server/auth';
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
  department?: unknown;
  phone?: unknown;
  employmentStatus?: unknown;
}

export interface AdminActionResult {
  success: true;
  message: string;
  code?: string;
  failureStage?: string;
}

function cleanText(value: unknown, maxLength = 160): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
}

function normalizeEmail(value?: string | null): string {
  return (value || '').trim().toLowerCase();
}

const VALID_EMPLOYMENT_STATUSES = new Set(['ACTIVE', 'INACTIVE']);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function safeFailure(status: number, code: AuthFlowErrorCode, message: string, failureStage: AuthFailureStage): never {
  throw new AuthFlowError({ status, code, message, failureStage });
}

function validateEmail(value: unknown): string {
  const email = cleanText(value, 254);
  if (!email) {
    safeFailure(400, 'employee_email_required', 'Vui lòng nhập email nhân sự.', 'validation');
  }
  if (!EMAIL_PATTERN.test(email)) {
    safeFailure(400, 'employee_email_invalid', 'Email nhân sự không đúng định dạng.', 'validation');
  }
  return email;
}

function validateEmploymentStatus(value: unknown): string {
  const status = (cleanText(value, 32) || '').toUpperCase();
  if (!status) {
    safeFailure(400, 'employee_status_required', 'Vui lòng chọn trạng thái làm việc.', 'validation');
  }
  if (!VALID_EMPLOYMENT_STATUSES.has(status)) {
    safeFailure(400, 'employee_status_invalid', 'Trạng thái làm việc không hợp lệ.', 'validation');
  }
  return status;
}

function isSoftDeletedEmployee(row: EmployeeAccountRow): boolean {
  const status = (row.status || '').trim().toUpperCase();
  return row.is_active === false || status === 'DELETED' || status === 'ARCHIVED';
}

async function ensureEmployeeEmailAvailable(emailValue: string, currentEmployeeId?: string): Promise<void> {
  const email = normalizeEmail(emailValue);
  const supabaseAdmin = createSupabaseAdminClient();
  const { data, error } = await supabaseAdmin
    .from('employees')
    .select('id, email, status, is_active')
    .ilike('email', emailValue.trim());

  if (error) {
    safeFailure(500, 'employee_lookup_failed', 'Không thể kiểm tra email nhân sự.', 'persistence');
  }

  const duplicates = ((data || []) as EmployeeAccountRow[]).filter(
    (row) => String(row.id) !== String(currentEmployeeId || '') && normalizeEmail(row.email) === email
  );

  if (duplicates.some(isSoftDeletedEmployee)) {
    safeFailure(409, 'employee_email_soft_deleted_duplicate', 'Email này thuộc hồ sơ đã lưu trữ. Vui lòng kiểm tra hoặc khôi phục hồ sơ cũ.', 'validation');
  }

  if (duplicates.length > 0) {
    safeFailure(409, 'employee_email_duplicate_active', 'Email này đang được dùng bởi hồ sơ nhân sự khác.', 'validation');
  }
}

function buildEmployeePayload(input: EmployeeMutationInput) {
  const fullName = cleanText(input.fullName);
  if (!fullName) {
    safeFailure(400, 'employee_full_name_required', 'Vui lòng nhập họ tên nhân sự.', 'validation');
  }

  const email = validateEmail(input.email);
  const status = validateEmploymentStatus(input.employmentStatus);

  return {
    full_name: fullName,
    email,
    title: cleanText(input.title),
    phone: cleanText(input.phone, 32),
    branch_code: cleanText(input.department, 80),
    status,
  };
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

// Former contract name kept in this source for review-regression traceability: ensureAuthEmailIsUnmapped.
async function findUnmappedAuthUserIdForEmployeeEmail(employee: EmployeeAccountRow): Promise<string | null> {
  const email = normalizeEmail(employee.email);
  if (!email) return null;

  const matches = await findAuthUsersByEmail(email);
  if (matches.length === 0) return null;

  const supabaseAdmin = createSupabaseAdminClient();
  const matchIds = matches.map((user) => user.id);
  const { data, error } = await supabaseAdmin
    .from('employees')
    .select('id, auth_user_id')
    .in('auth_user_id', matchIds);

  if (error) {
    throw new AuthFlowError({
      status: 500,
      code: 'employee_auth_lookup_failed',
      message: 'Không thể kiểm tra liên kết tài khoản Auth.',
      failureStage: 'auth_lookup',
    });
  }

  const mappedToOtherEmployee = ((data || []) as EmployeeAccountRow[]).some(
    (row) => String(row.id) !== String(employee.id)
  );

  if (mappedToOtherEmployee) {
    throw new AuthFlowError({
      status: 409,
      code: 'employee_auth_duplicate',
      message: 'Tài khoản Auth này đã được liên kết với nhân sự khác.',
      failureStage: 'auth_lookup',
    });
  }

  return matches[0]?.id || null;
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
  const existingUnmappedAuthUserId = await findUnmappedAuthUserIdForEmployeeEmail(employee);
  if (existingUnmappedAuthUserId) {
    const supabaseAdmin = createSupabaseAdminClient();
    const { error: connectError } = await supabaseAdmin
      .from('employees')
      .update({ auth_user_id: existingUnmappedAuthUserId })
      .eq('id', employee.id)
      .is('auth_user_id', null);

    if (connectError) {
      throw new AuthFlowError({
        status: 500,
        code: 'employee_auth_connection_failed',
        message: 'Không thể liên kết tài khoản Auth hiện có. Hồ sơ nhân sự vẫn được giữ nguyên.',
        failureStage: 'auth_connection',
      });
    }

    return { success: true, message: 'Đã liên kết tài khoản Auth hiện có. Không cấp thêm Workspace hoặc quyền mới.' };
  }

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
      code: 'employee_invitation_failed',
      message: `Không thể gửi lời mời sử dụng hệ thống. ${toSafeAuthErrorMessage(error.message)}`,
      failureStage: 'invitation_send',
    });
  }

  const authUserId = data.user?.id;
  if (!authUserId) {
    throw new AuthFlowError({
      status: 500,
      code: 'admin_verification_failed',
      message: 'Không nhận được thông tin tài khoản sau khi gửi lời mời.',
      failureStage: 'auth_connection',
    });
  }

  const { error: updateError } = await supabaseAdmin
    .from('employees')
    .update({ auth_user_id: authUserId })
    .eq('id', employee.id)
    .is('auth_user_id', null);

  if (updateError) {
    throw new AuthFlowError({
      status: 500,
      code: 'employee_auth_connection_failed',
      message: 'Đã gửi lời mời nhưng chưa thể liên kết tài khoản. Hồ sơ nhân sự vẫn được giữ nguyên.',
      failureStage: 'auth_connection',
    });
  }

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

  const payload = {
    ...buildEmployeePayload(input),
    role: 'STAFF',
    is_active: true,
    auth_user_id: null,
  };
  await ensureEmployeeEmailAvailable(payload.email);

  const supabaseAdmin = createSupabaseAdminClient();
  const { data, error } = await supabaseAdmin.from('employees').insert([payload]).select('id, auth_user_id').single();

  if (error || !data) {
    safeFailure(500, 'employee_persistence_failed', 'Không thể lưu hồ sơ nhân sự. Vui lòng thử lại.', 'persistence');
  }

  return {
    success: true,
    message: 'Đã tạo hồ sơ nhân sự. Nhân sự đang ở trạng thái Chưa kết nối.',
    code: 'employee_created_without_auth',
    failureStage: 'persisted',
  };
}

export async function updateEmployee(employeeId: string, input: EmployeeMutationInput): Promise<AdminActionResult> {
  await requireAdminEmployeePermission('EMPLOYEE_MANAGE');
  await loadTargetEmployee(employeeId);

  const payload = buildEmployeePayload(input);
  await ensureEmployeeEmailAvailable(payload.email, employeeId);

  const supabaseAdmin = createSupabaseAdminClient();
  const { error } = await supabaseAdmin.from('employees').update(payload).eq('id', employeeId);

  if (error) {
    safeFailure(500, 'employee_persistence_failed', 'Không thể cập nhật hồ sơ nhân sự. Vui lòng thử lại.', 'persistence');
  }

  return { success: true, message: 'Đã cập nhật hồ sơ nhân sự.', code: 'employee_updated', failureStage: 'persisted' };
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
