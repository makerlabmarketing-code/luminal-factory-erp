import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

describe('admin list production recovery boundaries', () => {
  it('keeps employee server failures inside the employee content boundary', () => {
    const page = read('app/admin/employees/page.tsx');
    expect(page).toContain('try {');
    expect(page).toContain('employee_list_load_failed');
    expect(page).not.toContain('notFound(');
  });

  it('preserves core employees when optional enrichment fails', () => {
    const service = read('services/server/adminEmployeeData.ts');
    expect(service).toContain("warnings:");
    expect(service).toContain("['employee_enrichment_failed']");
    expect(service).toContain('facilities: [] as FacilityDirectoryItem[]');
  });

  it('retries each list locally without reloading the application shell', () => {
    for (const file of ['app/admin/employees/AdminEmployeesClient.tsx', 'app/admin/accounts/AdminAccountsClient.tsx', 'app/admin/facilities/page.tsx']) {
      const source = read(file);
      expect(source).toContain('useAdminListData');
      expect(source).not.toContain('window.location.reload');
    }
  });

  it('uses narrow facility schema fallback and capability gates', () => {
    const directory = read('services/server/facilityDirectory.ts');
    const page = read('app/admin/facilities/page.tsx');
    expect(directory).toContain("error.code === '42703' || error.code === 'PGRST204'");
    expect(directory).toContain('if (!isKnownMissingFacilityColumn(current.error))');
    expect(directory).toContain('LEGACY_FACILITY_SELECT');
    expect(directory).toContain("code: (row.code || '').trim()");
    expect(page).toContain('Chức năng cập nhật cơ sở đang chờ kích hoạt.');
    expect(page).toContain("result.code === 'facility_schema_unavailable'");
    expect(page).toContain("b.address || 'Chưa cập nhật'");
  });

  it('aborts timed-out requests and rejects stale responses', () => {
    const hook = read('hooks/useAdminListData.ts');
    expect(hook).toContain('controller.abort()');
    expect(hook).toContain("setError('request_timeout')");
    expect(hook).toContain('sequence === sequenceRef.current');
    expect(hook).toContain('controllerRef.current?.abort()');
  });

  it('does not couple facility or account list reads to project membership', () => {
    for (const file of ['services/server/adminFacilities.ts', 'services/server/adminAccountManagement.ts']) {
      expect(read(file)).not.toContain('project_members');
    }
  });
});
