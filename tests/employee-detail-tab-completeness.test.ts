import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const read = (file: string) => readFileSync(join(process.cwd(), file), 'utf8');

describe('Employee Detail business-tab completeness', () => {
  const ui = read('app/admin/employees/[employeeId]/AdminEmployeeDetailClient.tsx');
  const service = read('services/server/adminEmployeeData.ts');
  const page = read('app/admin/employees/[employeeId]/page.tsx');
  const detail = service.slice(service.indexOf('export async function getAdminEmployeeDetailData'));
  const audit = read('docs/employee-detail-tab-audit.md');
  it('keeps profile tabs and tab-owned dirty payloads without duplicated modules', () => {
    for (const label of ['Tổng quan', 'Thông tin công việc', 'Dự án & công việc', 'Tài chính cá nhân', 'Lịch sử hoạt động']) expect(ui).toContain(label);
    expect(ui).not.toMatch(/Tài khoản & phân quyền|Lịch làm & chấm công/);
    expect(page).not.toContain('Đánh giá năng lực');
    expect(ui).toContain("overview: ['fullName', 'email', 'phone']");
    expect(ui).toContain("job: ['title', 'department', 'employmentStatus']");
    expect(ui).toContain("finance: ['bankName', 'bankAccountNumber', 'hourlyRate']");
  });
  it('loads project and task data after the core row without querying attendance or access details', () => {
    const core = detail.indexOf(".from('employees')");
    expect(core).toBeGreaterThan(-1);
    expect(detail.indexOf(".from('project_members')")).toBeGreaterThan(core);
    expect(detail.indexOf(".from('tasks')")).toBeGreaterThan(core);
    expect(detail).not.toMatch(/loadAttendanceData|employee_permissions|employee_workspace_access/);
    expect(detail).toContain("'employee_tasks_enrichment_failed'");
    expect(service).toContain('canEditPersonalFinance: canViewFinance && canEditEmployee');
  });
  it('renders empty and failure states locally without duplicating mutation routes', () => {
    const saveFlow = ui.slice(ui.indexOf('const save = async'), ui.indexOf('const editorActions ='));
    expect(ui).toContain("value === null || value === '' ? 'Chưa cập nhật' : value");
    expect(ui).toContain('function TabWarning');
    expect(ui).toContain('Thử tải lại');
    expect(ui).toContain('router.refresh()');
    expect(saveFlow).not.toContain('router.refresh()');
    expect(ui.match(/method: 'PATCH'/g)).toHaveLength(1);
    expect(ui).not.toContain("method: 'POST'");
  });
  it('records unsupported sources and a complete unexecuted operator package', () => {
    expect(audit).toContain('SCHEMA_EXTENSION_REQUIRED');
    for (const phase of ['pre_run', 'forward', 'post_run', 'rollback']) expect(audit).toContain(`20260729_employee_profile_extension_${phase}.sql`);
    expect(audit).toContain('20260729_employee_profile_extension_validation.sql');
    expect(audit).toContain('outside `supabase/migrations/`');
  });
});
