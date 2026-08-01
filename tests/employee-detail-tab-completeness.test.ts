import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const read = (file: string) => readFileSync(join(process.cwd(), file), 'utf8');

describe('Employee Detail business-tab completeness', () => {
  const ui = read('app/admin/employees/[employeeId]/AdminEmployeeDetailClient.tsx');
  const service = read('services/server/adminEmployeeData.ts');
  const audit = read('docs/employee-detail-tab-audit.md');
  it('preserves the seven domain tabs and tab-owned dirty payloads', () => {
    for (const label of ['Tổng quan', 'Thông tin công việc', 'Tài khoản & phân quyền', 'Dự án & công việc', 'Lịch làm & chấm công', 'Tài chính cá nhân', 'Lịch sử thay đổi']) expect(ui).toContain(label);
    expect(ui).toContain("overview: ['fullName', 'email', 'phone']");
    expect(ui).toContain("job: ['title', 'department', 'employmentStatus']");
    expect(ui).toContain("finance: ['bankName', 'bankAccountNumber', 'hourlyRate']");
  });
  it('loads project tasks and attendance as optional enrichment after the core row', () => {
    const core = service.indexOf(".from('employees')");
    expect(service.indexOf(".from('tasks')")).toBeGreaterThan(core);
    expect(service.indexOf('loadAttendanceData')).toBeGreaterThan(-1);
    expect(service).toContain("'employee_tasks_enrichment_failed'");
    expect(service).toContain("'employee_attendance_enrichment_failed'");
    expect(service).toContain('canEditPersonalFinance: canViewFinance && canEditEmployee');
  });
  it('renders empty and failure states locally without duplicating mutation routes', () => {
    expect(ui).toContain("value === null || value === '' ? 'Chưa cập nhật' : value");
    expect(ui).toContain('function TabWarning');
    expect(ui).toContain('Thử tải lại');
    expect(ui).toContain('router.refresh()');
    expect(ui.match(/method: 'PATCH'/g)).toHaveLength(1);
    expect(ui).toContain("path: 'send-password-reset'");
    expect(ui).toContain('Mở trình quản lý tài khoản và quyền');
  });
  it('records unsupported sources and a complete unexecuted operator package', () => {
    expect(audit).toContain('SCHEMA_EXTENSION_REQUIRED');
    for (const phase of ['pre_run', 'forward', 'post_run', 'rollback']) expect(audit).toContain(`20260729_employee_profile_extension_${phase}.sql`);
    expect(audit).toContain('20260729_employee_profile_extension_validation.sql');
    expect(audit).toContain('outside `supabase/migrations/`');
  });
});
