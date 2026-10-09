import type { Employee } from '@/lib/types/employee';

export interface AttendanceEmployeeSelection {
  employee: Employee | null;
  employeeId: string;
  displayName: string;
}

/** Keep the complete directory for historical records; filter only picker options. */
export function getAttendanceFilterEmployees(employees: Employee[]): Employee[] {
  return employees.filter((employee) => {
    const status = String(employee.status || '').trim().toUpperCase();
    return employee.is_active !== false && !['INACTIVE', 'LOCKED', 'DISABLED', 'DELETED', 'ARCHIVED'].includes(status);
  });
}

/**
 * Attendance relationships use employees.id. Never fall back to an email,
 * auth user id, or display name when the stable row id is unavailable.
 */
export function resolveAttendanceEmployeeSelection(
  employees: Employee[],
  selectedEmployeeId: number | string | null | undefined,
): AttendanceEmployeeSelection {
  const normalizedId = selectedEmployeeId == null ? '' : String(selectedEmployeeId).trim();
  const employee = normalizedId
    ? employees.find((candidate) => String(candidate.id) === normalizedId) || null
    : null;

  return {
    employee,
    employeeId: employee ? String(employee.id) : '',
    displayName: employee?.full_name || '',
  };
}
