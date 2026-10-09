import { describe, expect, it } from 'vitest';
import { getAttendanceFilterEmployees, resolveAttendanceEmployeeSelection } from '../lib/attendanceEmployeeSelection';
import type { Employee } from '../lib/types/employee';

describe('attendance employee filter options', () => {
  it('excludes disabled employees while preserving their historical directory entries', () => {
    const employees: Employee[] = [
      { id: 1, full_name: 'Đang hoạt động', status: 'ACTIVE', is_active: true },
      { id: 2, full_name: 'Đã vô hiệu hoá', status: 'ACTIVE', is_active: false },
      ...['INACTIVE', 'LOCKED', 'DISABLED', 'DELETED', 'ARCHIVED'].map((status, index) => ({
        id: index + 3, full_name: status, status: ` ${status.toLowerCase()} `, is_active: true,
      })),
    ];

    expect(getAttendanceFilterEmployees(employees).map((employee) => employee.id)).toEqual([1]);
    expect(employees).toHaveLength(7);
    expect(resolveAttendanceEmployeeSelection(employees, 2).displayName).toBe('Đã vô hiệu hoá');
  });

  it('keeps legacy entries with no inactive flag and handles an empty directory', () => {
    const employee: Employee = { id: 'legacy', full_name: 'Hồ sơ cũ', status: null, is_active: null };
    expect(getAttendanceFilterEmployees([employee])).toEqual([employee]);
    expect(getAttendanceFilterEmployees([])).toEqual([]);
  });
});
