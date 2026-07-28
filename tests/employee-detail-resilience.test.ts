import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

describe('employee detail enrichment resilience', () => {
  it('loads employee core before optional enrichment queries', () => {
    const service = read('services/server/adminEmployeeData.ts');
    const coreIndex = service.indexOf(".select('id, full_name, title, email, phone, status, is_active, auth_user_id, branch_code, hourly_rate, created_at')");
    const enrichmentIndex = service.indexOf('const [facilityResult, workspaceResult');
    expect(coreIndex).toBeGreaterThan(-1);
    expect(enrichmentIndex).toBeGreaterThan(coreIndex);
    expect(service).toContain("code: 'employee_detail_load_failed'");
  });

  it('converts facility, Auth, and workspace failures into partial-profile warnings', () => {
    const service = read('services/server/adminEmployeeData.ts');
    expect(service).toContain("'employee_facility_enrichment_failed'");
    expect(service).toContain("'account_lookup_failed'");
    expect(service).toContain("'employee_access_enrichment_failed'");
    expect(service).toContain('authLookupFailed: authResult.failed');
  });

  it('offers a local retry without a full-page reload', () => {
    const errorState = read('app/admin/employees/[employeeId]/EmployeeDetailErrorState.tsx');
    expect(errorState).toContain('router.refresh()');
    expect(errorState).toContain('Thử lại');
    expect(errorState).not.toContain('window.location.reload');
  });

  it('distinguishes invalid id, not found, forbidden, and core failure', () => {
    const page = read('app/admin/employees/[employeeId]/page.tsx');
    const service = read('services/server/adminEmployeeData.ts');
    expect(page).toContain('error.status === 400');
    expect(page).toContain('error.status === 404');
    expect(page).toContain('error.status === 403');
    expect(service).toContain("code: 'employee_detail_load_failed'");
  });
});
