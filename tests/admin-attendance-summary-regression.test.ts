import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const repositoryRoot = join(__dirname, '..');

function source(relativePath: string): string {
  return readFileSync(join(repositoryRoot, relativePath), 'utf8');
}

describe('Admin attendance summary regression', () => {
  const client = source('app/admin/attendance/page.tsx');
  const route = source('app/api/admin/attendance/route.ts');
  const dataSource = source('services/server/attendanceData.ts');
  const staffClient = source('app/staff/attendance/AttendanceView.tsx');

  it('scopes the source count request to the selected employee and month', () => {
    expect(client).toMatch(/new URLSearchParams\(\{ month: monthInput \}\)/);
    expect(client).toMatch(/searchParams\.set\('employeeId', filterEmployeeId\)/);
    expect(route).toMatch(/loadAttendanceData\(\{[\s\S]*monthInput,[\s\S]*employeeId/);
    expect(dataSource).toMatch(/attendanceQuery = attendanceQuery\.eq\('employee_id'/);
    expect(client).toContain('Nguồn trong phạm vi');
  });

  it('shows open, stale, excluded, and outside-month diagnostics explicitly', () => {
    expect(client).toContain('Bản ghi trong tháng');
    expect(client).toContain('chưa kết thúc');
    expect(client).toContain('bản ghi bị loại khỏi tổng hợp');
    expect(client).toContain('ca từ ngày trước');
    expect(client).toContain('bản ghi ngoài tháng đang chọn');
  });

  it('explains an empty selected-month calendar when outside records exist', () => {
    expect(client).toContain(
      'Không có bản ghi trong tháng đang chọn. Các bản ghi ngoài tháng đã được loại khỏi lịch và tổng hợp.'
    );
  });

  it('keeps stale recovery disabled and staff stale state controlled', () => {
    expect(route).toMatch(/process\.env\.ATTENDANCE_RECOVERY_ENABLED === 'true'/);
    expect(staffClient).toContain('Có ca làm trước đó chưa được kết thúc.');
    expect(staffClient).toContain("'Bắt đầu ca'");
  });

  it('returns aggregate diagnostics without employee or attendance identifiers', () => {
    const diagnosticContract = dataSource.slice(
      dataSource.indexOf('export interface AttendanceDataResult'),
      dataSource.indexOf('function timeFromInstant')
    );

    expect(diagnosticContract).toContain('diagnostics?: AttendanceScopeSummary | null');
    expect(diagnosticContract).not.toMatch(/employee_name|employeeId|rowId|attendanceId/);
  });
});
