import 'server-only';

import { AuthFlowError, hasPermission, type AuthFailureStage, type AuthFlowErrorCode } from '@/services/server/auth';
import { requireAdminEmployeePermission } from '@/services/server/adminEmployeeData';
import { AdminClientError, createSupabaseAdminClient } from '@/utils/supabase/admin';
import { persistAdminEmployee, sanitizeAdminMutationFailure, type AdminEmployeeDatabaseUpdate } from '@/services/server/adminEmployeePersistence';
import {
  AUTH_CALLBACK_PATH,
  buildUpdatePasswordRedirectPath,
  buildAuthRedirectUrl,
  buildPasswordRecoveryRedirectUrl,
  getPublicAppBaseUrl,
} from '@/utils/auth/flow';
import { findFacility, getFacilityDirectory } from '@/services/server/facilityDirectory';
import { validateEmployeeHourlyRate } from '@/lib/employeeHourlyRate';
import { parseEmployeeCreateRequest, type EmployeeCreateRequest } from '@/lib/employeeCreateContract';
import {
  buildEmployeeCreatePersistenceDiagnostics,
  inferEmployeeFieldErrors,
  recordEmployeeCreatePersistenceDiagnostic,
} from '@/lib/employeePersistenceDiagnostics';

interface EmployeeAccountRow {
  id: number | string;
  full_name?: string | null;
  email?: string | null;
  status?: string | null;
  is_active?: boolean | null;
  auth_user_id?: string | null;
  branch_code?: string | null;
  title?: string | null;
  phone?: string | null;
}

interface EmployeeMutationInput {
  fullName?: unknown;
  email?: unknown;
  title?: unknown;
  department?: unknown;
  phone?: unknown;
  bankName?: unknown;
  bankAccountNumber?: unknown;
  hourlyRate?: unknown;
  employmentStatus?: unknown;
}

export interface AdminActionResult {
  success: true;
  message: string;
  code?: string;
  failureStage?: string;
  employee?: EmployeeAccountRow;
  warnings?: string[];
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
const PHONE_PATTERN = /^\+?\d{8,15}$/;
function safeFailure(
  status: number,
  code: AuthFlowErrorCode,
  message: string,
  failureStage: AuthFailureStage,
  fieldErrors?: Record<string, string>
): never {
  throw new AuthFlowError({ status, code, message, failureStage, fieldErrors });
}

const CREATE_EMPLOYEE_SELECT = 'id, full_name, email, title, phone, status, is_active, auth_user_id, branch_code';

function throwCreatePersistenceFailure(
  error: unknown,
  correlationId: string | undefined,
  actorEmployeeId: string,
  failureStage: AuthFailureStage,
  requestReachedSupabase: boolean
): never {
  const safeDetails = sanitizeAdminMutationFailure(error);
  const diagnostic = buildEmployeeCreatePersistenceDiagnostics({
    correlationId,
    failureStage,
    requestReachedSupabase,
    readbackAttempted: failureStage === 'core_readback',
    rowCreated: false,
    details: safeDetails,
  });
  const diagnosticAvailable = recordEmployeeCreatePersistenceDiagnostic(diagnostic);
  console.error('[employee-persistence]', {
    ...diagnostic,
    method: 'POST',
    actorEmployeeId,
    authorizationResult: 'allowed',
    mutationKeys: ['auth_user_id', 'branch_code', 'email', 'full_name', 'is_active', 'role', 'status', 'phone', 'title'],
  });

  const supabaseCode = safeDetails.supabaseErrorCode;
  const databaseFieldErrors = inferEmployeeFieldErrors(safeDetails);
  const safeValidationFieldErrors = databaseFieldErrors || {
    form: 'Hệ thống không xác định được trường hồ sơ bị từ chối. Vui lòng kiểm tra dữ liệu và mã tra cứu.',
  };
  const databaseValidationStage: AuthFailureStage = requestReachedSupabase ? 'core_mutation' : failureStage;
  if (supabaseCode === '23505') {
    throw new AuthFlowError({
      status: 409,
      code: 'employee_email_duplicate_active',
      message: 'Email này đang được dùng bởi hồ sơ nhân sự khác.',
      failureStage: requestReachedSupabase ? 'core_mutation' : 'duplicate_check',
      safeDetails,
      fieldErrors: databaseFieldErrors,
      diagnosticAvailable,
    });
  }
  if (supabaseCode === '23502' || supabaseCode === '23514') {
    throw new AuthFlowError({
      status: 400,
      code: requestReachedSupabase ? 'employee_insert_constraint_failed' : 'payload_validation_failed',
      message: 'Thông tin hồ sơ nhân sự chưa hợp lệ.',
      failureStage: databaseValidationStage,
      safeDetails,
      fieldErrors: safeValidationFieldErrors,
      diagnosticAvailable,
    });
  }
  if (supabaseCode === '23503') {
    throw new AuthFlowError({
      status: 400,
      code: requestReachedSupabase ? 'employee_insert_constraint_failed' : 'payload_validation_failed',
      message: 'Thông tin liên kết hồ sơ nhân sự chưa hợp lệ.',
      failureStage: databaseValidationStage,
      safeDetails,
      fieldErrors: safeValidationFieldErrors,
      diagnosticAvailable,
    });
  }
  if (supabaseCode === '42501' || safeDetails.errorCategory === 'permission_or_credential') {
    throw new AuthFlowError({
      status: 403,
      code: 'permission_forbidden',
      message: 'Bạn không có quyền lưu hồ sơ nhân sự.',
      failureStage: requestReachedSupabase ? 'core_mutation' : 'permission_check',
      safeDetails,
      diagnosticAvailable,
    });
  }
  if (safeDetails.errorCategory === 'network' || safeDetails.errorCategory === 'schema_contract' || safeDetails.errorCategory === 'unavailable') {
    throw new AuthFlowError({
      status: 503,
      code: 'service_unavailable',
      message: 'Hệ thống chưa xác định được kết quả lưu hồ sơ. Vui lòng tra cứu theo email trước khi thử lại.',
      failureStage: failureStage === 'core_readback' ? 'core_readback' : requestReachedSupabase ? 'core_mutation' : failureStage,
      safeDetails,
      diagnosticAvailable,
    });
  }
  throw new AuthFlowError({
    status: 500,
    code: failureStage === 'core_readback' ? 'employee_insert_readback_failed' : 'employee_persistence_failed',
    message: 'Không thể lưu hồ sơ nhân sự. Vui lòng thử lại.',
    failureStage,
    safeDetails,
    diagnosticAvailable,
  });
}

async function readEmployeeByEmail(supabaseAdmin: ReturnType<typeof createSupabaseAdminClient>, email: string): Promise<EmployeeAccountRow[]> {
  const { data, error } = await supabaseAdmin
    .from('employees')
    .select('id, email')
    .ilike('email', email.trim());
  if (error) throw error;
  return ((data || []) as EmployeeAccountRow[]).filter((row) => normalizeEmail(row.email) === normalizeEmail(email));
}

async function recoverUncertainEmployeeCreate(
  supabaseAdmin: ReturnType<typeof createSupabaseAdminClient>,
  email: string,
  correlationId: string | undefined,
  actorEmployeeId: string
): Promise<AdminActionResult | null> {
  const matches = await readEmployeeByEmail(supabaseAdmin, email);
  if (matches.length !== 1) return null;

  console.warn('[employee-persistence]', {
    correlationId: correlationId || null,
    route: '/api/admin/employees',
    method: 'POST',
    actorEmployeeId,
    failureStage: 'core_readback',
    requestReachedSupabase: true,
    rowCreated: true,
    resultUncertain: true,
  });
  return {
    success: true,
    message: 'Hồ sơ đã được lưu nhưng phản hồi ban đầu không xác định. Vui lòng không gửi lại.',
    code: 'employee_created_after_uncertain_result',
    failureStage: 'persisted',
    employee: matches[0],
    warnings: ['employee_create_response_uncertain'],
  };
}

function validateEmail(value: unknown): string {
  const email = cleanText(value, 254);
  if (!email) {
    safeFailure(400, 'employee_email_required', 'Vui lòng nhập email nhân sự.', 'validation', { email: 'Vui lòng nhập email nhân sự.' });
  }
  if (!EMAIL_PATTERN.test(email)) {
    safeFailure(400, 'employee_email_invalid', 'Email nhân sự không đúng định dạng.', 'validation', { email: 'Email nhân sự không đúng định dạng.' });
  }
  return email.toLowerCase();
}

function validateEmployeeCreateShape(input: EmployeeMutationInput): EmployeeCreateRequest {
  const parsed = parseEmployeeCreateRequest(input);
  if (!parsed.success) {
    safeFailure(400, 'payload_validation_failed', 'Thông tin hồ sơ nhân sự chưa hợp lệ.', 'payload_validation', parsed.fieldErrors);
  }
  return parsed.data;
}

function validateEmploymentStatus(value: unknown): string {
  const status = (cleanText(value, 32) || '').toUpperCase();
  if (!status) {
    safeFailure(400, 'employee_status_required', 'Vui lòng chọn trạng thái làm việc.', 'validation', { employmentStatus: 'Vui lòng chọn trạng thái làm việc.' });
  }
  if (!VALID_EMPLOYMENT_STATUSES.has(status)) {
    safeFailure(400, 'employee_status_invalid', 'Trạng thái làm việc không hợp lệ.', 'validation', { employmentStatus: 'Trạng thái làm việc không hợp lệ.' });
  }
  return status;
}

export function normalizeEmployeePhone(value: unknown): string | null {
  const phone = cleanText(value, 32);
  if (!phone) return null;

  const normalizedPhone = phone.replace(/[\s.()-]/g, '');
  if (!PHONE_PATTERN.test(normalizedPhone)) {
    safeFailure(400, 'employee_phone_invalid', 'Số điện thoại không đúng định dạng.', 'validation', { phone: 'Số điện thoại không đúng định dạng.' });
  }

  return normalizedPhone;
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
    safeFailure(400, 'employee_full_name_required', 'Vui lòng nhập họ tên nhân sự.', 'validation', { fullName: 'Vui lòng nhập họ tên nhân sự.' });
  }

  const email = validateEmail(input.email);
  const status = validateEmploymentStatus(input.employmentStatus);

  return {
    full_name: fullName,
    email,
    title: cleanText(input.title),
    phone: normalizeEmployeePhone(input.phone),
    branch_code: cleanText(input.department, 80),
    status,
  };
}

async function buildEmployeeUpdatePayload(
  input: EmployeeMutationInput,
  current: EmployeeAccountRow
): Promise<AdminEmployeeDatabaseUpdate> {
  const payload: AdminEmployeeDatabaseUpdate = {};

  if (Object.prototype.hasOwnProperty.call(input, 'fullName')) {
    const fullName = cleanText(input.fullName);
    if (!fullName) safeFailure(400, 'employee_full_name_required', 'Vui lòng nhập họ tên nhân sự.', 'validation', { fullName: 'Vui lòng nhập họ tên nhân sự.' });
    payload.full_name = fullName;
  }
  if (Object.prototype.hasOwnProperty.call(input, 'email')) payload.email = validateEmail(input.email);
  if (Object.prototype.hasOwnProperty.call(input, 'title')) payload.title = cleanText(input.title);
  if (Object.prototype.hasOwnProperty.call(input, 'phone')) payload.phone = normalizeEmployeePhone(input.phone);
  if (Object.prototype.hasOwnProperty.call(input, 'bankName')) payload.bank_name = cleanText(input.bankName, 120);
  if (Object.prototype.hasOwnProperty.call(input, 'bankAccountNumber')) payload.bank_account_number = cleanText(input.bankAccountNumber, 80);
  if (Object.prototype.hasOwnProperty.call(input, 'hourlyRate')) {
    const hourlyRate = validateEmployeeHourlyRate(input.hourlyRate);
    if (!hourlyRate.ok) safeFailure(400, 'payload_validation_failed', hourlyRate.message, 'validation');
    payload.hourly_rate = hourlyRate.value;
  }
  if (Object.prototype.hasOwnProperty.call(input, 'employmentStatus')) payload.status = validateEmploymentStatus(input.employmentStatus);
  if (Object.prototype.hasOwnProperty.call(input, 'department')) {
    payload.branch_code = await validateFacilityAssignment(input.department, current.branch_code);
  }

  if (Object.keys(payload).length === 0) {
    safeFailure(400, 'employee_update_empty', 'Không có thay đổi hợp lệ để lưu.', 'validation');
  }
  return payload;
}

async function validateFacilityAssignment(value: unknown, currentValue?: string | null): Promise<string | null> {
  const requestedCode = cleanText(value, 80);
  if (!requestedCode) return null;
  if (currentValue && requestedCode === currentValue) return currentValue;

  const facilities = await getFacilityDirectory();
  const facility = findFacility(facilities, requestedCode);
  const unchangedInactive = facility && !facility.isActive && facility.code === currentValue;

  if (!facility) {
    safeFailure(404, 'employee_facility_invalid', 'Không tìm thấy cơ sở làm việc đã chọn.', 'validation', { department: 'Không tìm thấy cơ sở làm việc đã chọn.' });
  }
  if (!facility.isActive && !unchangedInactive) {
    safeFailure(400, 'employee_facility_invalid', 'Cơ sở làm việc không còn hoạt động. Vui lòng chọn cơ sở khác.', 'validation', { department: 'Cơ sở làm việc không còn hoạt động. Vui lòng chọn cơ sở khác.' });
  }

  return facility.code;
}

function isActiveEmployee(row: EmployeeAccountRow): boolean {
  const status = (row.status || '').trim().toUpperCase();
  return row.is_active !== false && status !== 'INACTIVE' && status !== 'LOCKED';
}

function isMissingTarget(error?: { code?: string } | null): boolean {
  return error?.code === 'PGRST116';
}

function isEmployeeInsertReadbackError(details: ReturnType<typeof sanitizeAdminMutationFailure>): boolean {
  return details.supabaseErrorCode === 'PGRST116';
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
  let supabaseAdmin;
  try {
    supabaseAdmin = createSupabaseAdminClient();
  } catch (error) {
    const configurationFailure = error instanceof AdminClientError && error.code === 'admin_client_configuration_failed';
    throw new AuthFlowError({
      status: 500,
      code: configurationFailure ? 'admin_client_configuration_failed' : 'employee_persistence_failed',
      message: 'Không thể cập nhật hồ sơ nhân sự. Vui lòng thử lại.',
      failureStage: configurationFailure ? 'admin_client_configuration' : 'admin_client_creation',
      safeDetails: {
        supabase_operation: 'client_creation',
        target_relation: 'public.employees',
      },
    });
  }
  const { data, error } = await supabaseAdmin
    .from('employees')
    .select('id, full_name, email, title, phone, status, is_active, auth_user_id, branch_code')
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

export async function createEmployee(input: EmployeeMutationInput, correlationId?: string): Promise<AdminActionResult> {
  const actor = await requireAdminEmployeePermission('EMPLOYEE_MANAGE');
  const normalizedInput = validateEmployeeCreateShape(input);

  const payload = {
    ...buildEmployeePayload(normalizedInput),
    branch_code: await validateFacilityAssignment(normalizedInput.department),
    role: 'STAFF',
    is_active: true,
    auth_user_id: null,
  };
  await ensureEmployeeEmailAvailable(payload.email);

  let supabaseAdmin: ReturnType<typeof createSupabaseAdminClient>;
  try {
    supabaseAdmin = createSupabaseAdminClient();
  } catch (error) {
    throwCreatePersistenceFailure(error, correlationId, String(actor.employee.id), 'admin_client_creation', false);
  }

  let result: { data: EmployeeAccountRow | null; error: unknown };
  try {
    result = await supabaseAdmin.from('employees').insert([payload]).select(CREATE_EMPLOYEE_SELECT).single();
  } catch (error) {
    const safeDetails = sanitizeAdminMutationFailure(error);
    if (safeDetails.errorCategory === 'network' || safeDetails.errorCategory === 'schema_contract' || safeDetails.errorCategory === 'unavailable') {
      try {
        const recovered = await recoverUncertainEmployeeCreate(supabaseAdmin, payload.email, correlationId, String(actor.employee.id));
        if (recovered) return recovered;
      } catch (readbackError) {
        throwCreatePersistenceFailure(readbackError, correlationId, String(actor.employee.id), 'core_readback', true);
      }
    }
    throwCreatePersistenceFailure(error, correlationId, String(actor.employee.id), 'core_mutation', true);
  }

  if (result.error) {
    const safeDetails = sanitizeAdminMutationFailure(result.error);
    if (isEmployeeInsertReadbackError(safeDetails)) {
      try {
        const recovered = await recoverUncertainEmployeeCreate(supabaseAdmin, payload.email, correlationId, String(actor.employee.id));
        if (recovered) return recovered;
      } catch (readbackError) {
        throwCreatePersistenceFailure(readbackError, correlationId, String(actor.employee.id), 'core_readback', true);
      }
      throwCreatePersistenceFailure(result.error, correlationId, String(actor.employee.id), 'core_readback', true);
    }
    if (safeDetails.errorCategory === 'network' || safeDetails.errorCategory === 'schema_contract' || safeDetails.errorCategory === 'unavailable') {
      try {
        const recovered = await recoverUncertainEmployeeCreate(supabaseAdmin, payload.email, correlationId, String(actor.employee.id));
        if (recovered) return recovered;
      } catch (readbackError) {
        throwCreatePersistenceFailure(readbackError, correlationId, String(actor.employee.id), 'core_readback', true);
      }
    }
    throwCreatePersistenceFailure(result.error, correlationId, String(actor.employee.id), 'core_mutation', true);
  }

  if (!result.data) {
    try {
      const recovered = await recoverUncertainEmployeeCreate(supabaseAdmin, payload.email, correlationId, String(actor.employee.id));
      if (recovered) return recovered;
    } catch (readbackError) {
      throwCreatePersistenceFailure(readbackError, correlationId, String(actor.employee.id), 'core_readback', true);
    }
    throwCreatePersistenceFailure({ code: 'employee_create_result_missing' }, correlationId, String(actor.employee.id), 'returned_result_decode', true);
  }

  return {
    success: true,
    message: 'Đã tạo hồ sơ nhân sự. Nhân sự đang ở trạng thái Chưa kết nối.',
    code: 'employee_created_without_auth',
    failureStage: 'persisted',
    employee: result.data,
  };
}

export async function updateEmployee(employeeId: string, input: EmployeeMutationInput, correlationId?: string): Promise<AdminActionResult> {
  const actor = await requireAdminEmployeePermission('EMPLOYEE_MANAGE');
  const touchesPersonalFinance =
    Object.prototype.hasOwnProperty.call(input, 'bankName') ||
    Object.prototype.hasOwnProperty.call(input, 'bankAccountNumber') ||
    Object.prototype.hasOwnProperty.call(input, 'hourlyRate');
  if (touchesPersonalFinance && !(await hasPermission(actor, 'FINANCE_VIEW'))) {
    safeFailure(403, 'permission_forbidden', 'Bạn không có quyền cập nhật thông tin tài chính cá nhân.', 'permission_check');
  }
  const targetEmployee = await loadTargetEmployee(employeeId);

  const payload = await buildEmployeeUpdatePayload(input, targetEmployee);
  if (payload.email) await ensureEmployeeEmailAvailable(payload.email, employeeId);

  let supabaseAdmin;
  try {
    supabaseAdmin = createSupabaseAdminClient();
  } catch (error) {
    const configurationFailure = error instanceof AdminClientError && error.code === 'admin_client_configuration_failed';
    throw new AuthFlowError({
      status: 500,
      code: configurationFailure ? 'admin_client_configuration_failed' : 'employee_persistence_failed',
      message: 'Không thể cập nhật hồ sơ nhân sự. Vui lòng thử lại.',
      failureStage: configurationFailure ? 'admin_client_configuration' : 'admin_client_creation',
      safeDetails: {
        supabase_operation: 'client_creation',
        target_relation: 'public.employees',
      },
    });
  }
  const trace = { requestReachedSupabase: false, rowUpdated: false };
  let persisted: EmployeeAccountRow | null = null;
  let readbackError: unknown = null;
  try {
    const result = await persistAdminEmployee(supabaseAdmin, employeeId, payload, trace);
    persisted = result.data as EmployeeAccountRow | null;
    readbackError = result.readbackError;
  } catch (error) {
    const record = typeof error === 'object' && error !== null ? error as { failureStage?: AuthFailureStage; diagnosticCause?: unknown } : null;
    const failureStage = record?.failureStage || 'core_mutation';
    const safeDetails = sanitizeAdminMutationFailure(record?.diagnosticCause ?? error);
    console.error('[employee-persistence]', {
      correlationId: correlationId || null,
      route: `/api/admin/employees/${employeeId}`,
      method: 'PATCH',
      actorEmployeeId: String(actor.employee.id),
      authorizationResult: 'allowed',
      targetEmployeeId: String(employeeId),
      failureStage,
      mutationKeys: Object.keys(payload).sort(),
      requestReachedSupabase: trace.requestReachedSupabase,
      rowUpdated: trace.rowUpdated,
      ...safeDetails,
    });
    throw new AuthFlowError({
      status: 500,
      code: 'employee_persistence_failed',
      message: 'Không thể cập nhật hồ sơ nhân sự. Vui lòng thử lại.',
      failureStage,
      safeDetails: { ...safeDetails, requestReachedSupabase: trace.requestReachedSupabase, rowUpdated: trace.rowUpdated },
    });
  }

  if (readbackError || !persisted) {
    console.warn('[employee-persistence]', {
      correlationId: correlationId || null,
      route: `/api/admin/employees/${employeeId}`,
      method: 'PATCH',
      actorEmployeeId: String(actor.employee.id),
      targetEmployeeId: String(employeeId),
      authorizationResult: 'allowed',
      failureStage: 'core_readback',
      sourceBoundary: 'services/server/adminEmployeeActions.ts:updateEmployee',
      mutationKeys: Object.keys(payload).sort(),
      requestReachedSupabase: trace.requestReachedSupabase,
      rowUpdated: trace.rowUpdated,
      supabaseOperation: 'select',
      targetRelation: 'public.employees',
      supabaseErrorCode: sanitizeAdminMutationFailure(readbackError).supabaseErrorCode || 'row_not_returned',
    });
  }

  console.info('[employee-persistence]', {
    correlationId: correlationId || null,
    route: `/api/admin/employees/${employeeId}`,
    method: 'PATCH',
    actorEmployeeId: String(actor.employee.id),
    targetEmployeeId: String(employeeId),
    authorizationResult: 'allowed',
    failureStage: 'persisted',
    mutationKeys: Object.keys(payload).sort(),
    rowUpdated: trace.rowUpdated,
  });

  return {
    success: true,
    message: 'Đã cập nhật hồ sơ nhân sự.',
    code: 'employee_updated',
    failureStage: 'persisted',
    employee: (persisted || { ...targetEmployee, ...payload }) as EmployeeAccountRow,
    warnings: readbackError || !persisted ? ['employee_readback_failed'] : [],
  };
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
