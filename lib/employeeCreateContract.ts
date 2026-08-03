export const EMPLOYEE_CREATE_FIELDS = [
  'fullName',
  'email',
  'title',
  'department',
  'phone',
  'employmentStatus',
] as const;

export type EmployeeEmploymentStatus = 'ACTIVE' | 'INACTIVE';

export interface EmployeeCreateRequest {
  fullName: string;
  email: string;
  title: string;
  department: string;
  phone: string;
  employmentStatus: EmployeeEmploymentStatus;
}

export type EmployeeCreateParseResult =
  | { success: true; data: EmployeeCreateRequest }
  | { success: false; fieldErrors: Record<string, string> };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMPLOYEE_CREATE_FIELD_SET = new Set<string>(EMPLOYEE_CREATE_FIELDS);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readOptionalText(value: unknown, field: 'title' | 'phone', errors: Record<string, string>): string {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') {
    errors[field] = field === 'phone' ? 'Số điện thoại không hợp lệ.' : 'Chức vụ không hợp lệ.';
    return '';
  }
  return value.trim();
}

/**
 * Parses the exact create payload shared by the Admin form and server action.
 * It intentionally does not resolve facilities or persist data; those checks
 * remain server-owned and happen after this contract has passed.
 */
export function parseEmployeeCreateRequest(input: unknown): EmployeeCreateParseResult {
  const fieldErrors: Record<string, string> = {};
  if (!isRecord(input)) {
    return { success: false, fieldErrors: { form: 'Dữ liệu hồ sơ nhân sự không hợp lệ.' } };
  }

  const unknownFields = Object.keys(input).filter((field) => !EMPLOYEE_CREATE_FIELD_SET.has(field));
  if (unknownFields.length > 0) {
    fieldErrors.form = 'Biểu mẫu chứa trường không được hỗ trợ. Vui lòng tải lại và thử lại.';
  }

  const fullName = typeof input.fullName === 'string' ? input.fullName.trim() : '';
  if (input.fullName === undefined || input.fullName === null || fullName === '') {
    fieldErrors.fullName = 'Vui lòng nhập họ tên nhân sự.';
  } else if (typeof input.fullName !== 'string') {
    fieldErrors.fullName = 'Họ tên nhân sự không hợp lệ.';
  }

  const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
  if (input.email === undefined || input.email === null || email === '') {
    fieldErrors.email = 'Vui lòng nhập email nhân sự.';
  } else if (typeof input.email !== 'string') {
    fieldErrors.email = 'Email nhân sự không hợp lệ.';
  } else if (!EMAIL_PATTERN.test(email)) {
    fieldErrors.email = 'Email nhân sự không đúng định dạng.';
  }

  const title = readOptionalText(input.title, 'title', fieldErrors);
  if (!title && !fieldErrors.title) fieldErrors.title = 'Vui lòng nhập chức vụ nhân sự.';
  const phone = readOptionalText(input.phone, 'phone', fieldErrors);
  let department = '';
  if (input.department !== undefined && input.department !== null) {
    if (typeof input.department === 'string') department = input.department.trim();
    else fieldErrors.department = 'Cơ sở làm việc không hợp lệ.';
  }

  const rawStatus = typeof input.employmentStatus === 'string' ? input.employmentStatus.trim().toUpperCase() : '';
  if (input.employmentStatus === undefined || input.employmentStatus === null || rawStatus === '') {
    fieldErrors.employmentStatus = 'Vui lòng chọn trạng thái làm việc.';
  } else if (typeof input.employmentStatus !== 'string' || (rawStatus !== 'ACTIVE' && rawStatus !== 'INACTIVE')) {
    fieldErrors.employmentStatus = 'Vui lòng chọn trạng thái làm việc hợp lệ.';
  }

  if (Object.keys(fieldErrors).length > 0) return { success: false, fieldErrors };

  return {
    success: true,
    data: {
      fullName,
      email,
      title,
      department,
      phone,
      employmentStatus: rawStatus as EmployeeEmploymentStatus,
    },
  };
}
