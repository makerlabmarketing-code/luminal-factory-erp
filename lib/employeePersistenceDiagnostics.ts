export interface SanitizedEmployeeFailure {
  errorCategory?: string | null;
  supabaseErrorCode?: string | null;
  supabaseConstraint?: string | null;
  supabaseColumn?: string | null;
}

export type EmployeeCreateOperationStage =
  | 'employee_insert'
  | 'employee_insert_readback'
  | 'employee_post_insert_processing'
  | 'employee_audit_write';

/**
 * Safe, same-response evidence for the already-authorized Admin who submitted
 * the create request. This deliberately contains no request or database text.
 */
export interface EmployeeCreateSafeDiagnostic {
  available: true;
  operationStage: EmployeeCreateOperationStage;
  databaseCode: string;
  table: string;
  column: string;
  constraint: string;
  rowReturned: boolean;
  readbackAttempted: boolean;
  category: string;
}

const UNAVAILABLE = 'unavailable';

const EMPLOYEE_SAFE_COLUMNS = new Set([
  'id', 'full_name', 'email', 'title', 'phone', 'branch_code', 'status', 'role',
  'is_active', 'auth_user_id', 'hourly_rate', 'bank_name',
  'bank_account_number', 'employee_code', 'created_by_employee_id', 'tenant_id',
  'workspace_id',
]);

// Only constraints evidenced by tracked migrations or the established contract
// cross the response boundary. Unknown production constraints stay unknown.
const EMPLOYEE_SAFE_CONSTRAINTS = new Set([
  'employees_auth_user_id_fkey',
  'employees_auth_user_id_unique_not_null',
  'employees_email_key',
  'employees_email_unique',
  'employees_full_name_not_null',
  'employees_email_not_null',
  'employees_status_check',
  'employees_role_check',
  'employees_hourly_rate_check',
  'employees_branch_code_fkey',
  'employees_facility_id_fkey',
  'employees_created_by_employee_id_fkey',
  'employees_tenant_id_fkey',
  'employees_workspace_id_fkey',
]);

const SAFE_CATEGORIES = new Set([
  'database_constraint', 'permission_or_credential', 'schema_contract',
  'network', 'unavailable', 'unexpected',
]);

const DATABASE_COLUMN_FIELD_MAP: Record<string, string> = {
  full_name: 'fullName', email: 'email', title: 'title', phone: 'phone',
  branch_code: 'department', status: 'employmentStatus',
};

const DATABASE_CONSTRAINT_FIELD_MAP: Record<string, string> = {
  employees_full_name_not_null: 'fullName', employees_email_not_null: 'email',
  employees_email_key: 'email', employees_email_unique: 'email',
  employees_status_check: 'employmentStatus', employees_role_check: 'form',
  employees_hourly_rate_check: 'form', employees_branch_code_fkey: 'department',
  employees_facility_id_fkey: 'department', employees_auth_user_id_fkey: 'form',
  employees_auth_user_id_unique_not_null: 'form',
  employees_created_by_employee_id_fkey: 'form', employees_tenant_id_fkey: 'form',
  employees_workspace_id_fkey: 'form',
};

export function allowlistedEmployeeColumn(value?: string | null): string | null {
  return value && EMPLOYEE_SAFE_COLUMNS.has(value) ? value : null;
}

export function allowlistedEmployeeConstraint(value?: string | null): string | null {
  return value && EMPLOYEE_SAFE_CONSTRAINTS.has(value) ? value : null;
}

export function normalizeEmployeePostgresCode(value?: string | null): string | null {
  return value && (/^\d{5}$/.test(value) || /^PGRST\d{3}$/.test(value)) ? value : null;
}

export function inferEmployeeFieldErrors(details: SanitizedEmployeeFailure): Record<string, string> | undefined {
  const column = allowlistedEmployeeColumn(details.supabaseColumn);
  const constraint = allowlistedEmployeeConstraint(details.supabaseConstraint);
  const field = (column && DATABASE_COLUMN_FIELD_MAP[column]) || (constraint && DATABASE_CONSTRAINT_FIELD_MAP[constraint]);
  if (!field) return undefined;

  const messages: Record<string, string> = {
    fullName: 'Vui lòng nhập họ tên nhân sự.', email: 'Vui lòng kiểm tra email nhân sự.',
    department: 'Vui lòng chọn cơ sở làm việc hợp lệ.',
    employmentStatus: 'Vui lòng chọn trạng thái làm việc hợp lệ.',
    phone: 'Số điện thoại không hợp lệ.', title: 'Chức vụ không hợp lệ.',
    form: 'Thông tin liên kết hoặc cấu hình hồ sơ chưa hợp lệ.',
  };
  return { [field]: messages[field] };
}

export function buildEmployeeCreateSafeDiagnostic(params: {
  operationStage: EmployeeCreateOperationStage;
  readbackAttempted: boolean;
  rowReturned: boolean;
  details: SanitizedEmployeeFailure;
}): EmployeeCreateSafeDiagnostic {
  return {
    available: true,
    operationStage: params.operationStage,
    databaseCode: normalizeEmployeePostgresCode(params.details.supabaseErrorCode) || UNAVAILABLE,
    table: 'employees',
    column: allowlistedEmployeeColumn(params.details.supabaseColumn) || UNAVAILABLE,
    constraint: allowlistedEmployeeConstraint(params.details.supabaseConstraint) || UNAVAILABLE,
    rowReturned: params.rowReturned,
    readbackAttempted: params.readbackAttempted,
    category: params.details.errorCategory && SAFE_CATEGORIES.has(params.details.errorCategory)
      ? params.details.errorCategory
      : UNAVAILABLE,
  };
}
