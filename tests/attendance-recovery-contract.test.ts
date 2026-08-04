import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repositoryRoot = join(__dirname, '..');

function source(relativePath: string): string {
  return readFileSync(join(repositoryRoot, relativePath), 'utf8');
}

describe('attendance recovery contract', () => {
  it('keeps attendance employee selects on live schema columns', () => {
    const dataSource = source('services/server/attendanceData.ts');
    const routeSource = source('app/api/admin/attendance/route.ts');
    const attendanceService = source('services/attendanceService.ts');
    const staffRoute = source('app/api/staff/attendance/route.ts');

    expect(dataSource).toMatch(/EMPLOYEE_SELECT/);
    expect(dataSource).not.toMatch(/base_salary_per_hour/);
    expect(dataSource).not.toMatch(/EMPLOYEE_SELECT =\n\s*'[^']*hourly_rate/);
    expect(routeSource).not.toMatch(/base_salary_per_hour/);
    expect(attendanceService).not.toMatch(/base_salary_per_hour/);
    expect(staffRoute).not.toMatch(/base_salary_per_hour/);
  });

  it('returns stable attendance error codes instead of a combined load-update error', () => {
    const routeSource = source('app/api/admin/attendance/route.ts');
    const clientSource = source('app/admin/attendance/page.tsx');

    expect(routeSource).toMatch(/attendance_load_failed/);
    expect(routeSource).toMatch(/attendance_update_failed/);
    expect(routeSource).toMatch(/attendance_permission_denied/);
    expect(routeSource).toMatch(/failure_stage/);
    expect(routeSource).toMatch(/supabase_error_code/);
    expect(routeSource).not.toMatch(/Không thể tải hoặc cập nhật dữ liệu chấm công/);
    expect(clientSource).toMatch(/messageForAttendanceLoadError/);
    expect(clientSource).toMatch(/Thử lại/);
  });

  it('keeps admin attendance read behind ATTENDANCE_VIEW and mutations behind ATTENDANCE_MANAGE', () => {
    const routeSource = source('app/api/admin/attendance/route.ts');

    expect(routeSource).toMatch(/requireWorkspaceAccess\('ADMIN_WORKSPACE'\)/);
    expect(routeSource).toMatch(/hasPermission\(authContext, 'ATTENDANCE_VIEW'\)/);
    expect(routeSource).toMatch(/hasPermission\(authContext, 'ATTENDANCE_MANAGE'\)/);
  });

  it('keeps manual attendance mutations independently gated until the audited RPC is enabled', () => {
    const routeSource = source('app/api/admin/attendance/route.ts');
    const clientSource = source('app/admin/attendance/page.tsx');

    expect(routeSource).toMatch(/isAttendanceManualMutationEnabled\(\)/);
    expect(routeSource).toMatch(/attendance_manual_mutation_disabled/);
    expect(routeSource).toMatch(/canManage && isAttendanceManualMutationEnabled\(\)/);
    expect(clientSource).toMatch(/Điều chỉnh chấm công đang chờ xác nhận/);
    expect(clientSource).not.toMatch(/t_mock/);
  });
});
