export interface SanitizedEmployeeFailure {
  errorCategory?: string | null;
  supabaseErrorCode?: string | null;
  supabaseConstraint?: string | null;
  supabaseColumn?: string | null;
}

export interface EmployeeCreatePersistenceDiagnostic {
  correlationId: string | null;
  timestamp: string;
  route: '/api/admin/employees';
  operation: 'employee_create';
  table: 'employees';
  failureStage: string;
  requestReachedSupabase: boolean;
  insertReturnedRowCount: number;
  rowReturned: boolean;
  readbackAttempted: boolean;
  rowCreated: boolean;
  errorCategory: string | null;
  supabaseErrorCode: string | null;
  supabaseColumn: string | null;
  supabaseConstraint: string | null;
}

const EMPLOYEE_DIAGNOSTIC_TTL_MS = 15 * 60 * 1000;
const EMPLOYEE_DIAGNOSTIC_MAX_ENTRIES = 100;
const employeeDiagnosticStoreKey = Symbol.for('luminal.employee-create-diagnostics');

type DiagnosticStore = Map<string, EmployeeCreatePersistenceDiagnostic>;

function getDiagnosticStore(): DiagnosticStore {
  const runtime = globalThis as typeof globalThis & { [employeeDiagnosticStoreKey]?: DiagnosticStore };
  if (!runtime[employeeDiagnosticStoreKey]) runtime[employeeDiagnosticStoreKey] = new Map();
  return runtime[employeeDiagnosticStoreKey]!;
}

function pruneDiagnosticStore(now = Date.now()) {
  const store = getDiagnosticStore();
  for (const [correlationId, entry] of Array.from(store.entries())) {
    if (Date.parse(entry.timestamp) + EMPLOYEE_DIAGNOSTIC_TTL_MS <= now) store.delete(correlationId);
  }
  while (store.size > EMPLOYEE_DIAGNOSTIC_MAX_ENTRIES) {
    const oldest = store.keys().next().value;
    if (!oldest) break;
    store.delete(oldest);
  }
}

export function recordEmployeeCreatePersistenceDiagnostic(
  diagnostic: Omit<EmployeeCreatePersistenceDiagnostic, 'timestamp'>,
  now = new Date()
): boolean {
  if (!diagnostic.correlationId) return false;
  const store = getDiagnosticStore();
  pruneDiagnosticStore(now.getTime());
  store.delete(diagnostic.correlationId);
  store.set(diagnostic.correlationId, { ...diagnostic, timestamp: now.toISOString() });
  pruneDiagnosticStore(now.getTime());
  return true;
}

export function readEmployeeCreatePersistenceDiagnostic(
  correlationId: string,
  now = new Date()
): EmployeeCreatePersistenceDiagnostic | null {
  const store = getDiagnosticStore();
  pruneDiagnosticStore(now.getTime());
  return store.get(correlationId) || null;
}

export function isEmployeeDiagnosticCorrelationId(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

const EMPLOYEE_SAFE_COLUMNS = new Set([
  'id',
  'full_name',
  'email',
  'title',
  'phone',
  'branch_code',
  'status',
  'role',
  'is_active',
  'auth_user_id',
  'hourly_rate',
  'bank_name',
  'bank_account_number',
  'employee_code',
  'created_by_employee_id',
  'tenant_id',
  'workspace_id',
]);

// Only names evidenced by tracked migrations or the established employee
// contract are retained. Unknown constraint names remain internal-only.
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

const DATABASE_COLUMN_FIELD_MAP: Record<string, string> = {
  full_name: 'fullName',
  email: 'email',
  title: 'title',
  phone: 'phone',
  branch_code: 'department',
  status: 'employmentStatus',
};

const DATABASE_CONSTRAINT_FIELD_MAP: Record<string, string> = {
  employees_full_name_not_null: 'fullName',
  employees_email_not_null: 'email',
  employees_email_key: 'email',
  employees_email_unique: 'email',
  employees_status_check: 'employmentStatus',
  employees_role_check: 'form',
  employees_hourly_rate_check: 'form',
  employees_branch_code_fkey: 'department',
  employees_facility_id_fkey: 'department',
  employees_auth_user_id_fkey: 'form',
  employees_auth_user_id_unique_not_null: 'form',
  employees_created_by_employee_id_fkey: 'form',
  employees_tenant_id_fkey: 'form',
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
    fullName: 'Vui lòng nhập họ tên nhân sự.',
    email: 'Vui lòng kiểm tra email nhân sự.',
    department: 'Vui lòng chọn cơ sở làm việc hợp lệ.',
    employmentStatus: 'Vui lòng chọn trạng thái làm việc hợp lệ.',
    phone: 'Số điện thoại không hợp lệ.',
    title: 'Chức vụ không hợp lệ.',
    form: 'Thông tin liên kết hoặc cấu hình hồ sơ chưa hợp lệ.',
  };
  return { [field]: messages[field] };
}

export function buildEmployeeCreatePersistenceDiagnostics(params: {
  correlationId?: string;
  failureStage: string;
  requestReachedSupabase: boolean;
  readbackAttempted: boolean;
  rowCreated: boolean;
  details: SanitizedEmployeeFailure;
}): Omit<EmployeeCreatePersistenceDiagnostic, 'timestamp'> {
  return {
    correlationId: params.correlationId || null,
    route: '/api/admin/employees' as const,
    operation: 'employee_create' as const,
    table: 'employees' as const,
    failureStage: params.failureStage,
    requestReachedSupabase: params.requestReachedSupabase,
    insertReturnedRowCount: params.rowCreated ? 1 : 0,
    rowReturned: params.rowCreated,
    readbackAttempted: params.readbackAttempted,
    rowCreated: params.rowCreated,
    errorCategory: params.details.errorCategory || null,
    supabaseErrorCode: normalizeEmployeePostgresCode(params.details.supabaseErrorCode),
    supabaseColumn: allowlistedEmployeeColumn(params.details.supabaseColumn),
    supabaseConstraint: allowlistedEmployeeConstraint(params.details.supabaseConstraint),
  };
}
