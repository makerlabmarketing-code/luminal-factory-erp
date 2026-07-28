import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

describe('Facility Directory recovery contract', () => {
  it('returns successful list data through the request-scoped, RLS-aware reader', () => {
    const service = read('services/server/adminFacilities.ts');
    expect(service).toContain('loadFacilityDirectory(await createClient())');
    expect(service).toContain('success: true');
    expect(service).toContain('facilities: directory.facilities.map');
  });

  it('returns a stable retryable API failure instead of throwing through the route', () => {
    const route = read('app/api/admin/facilities/route.ts');
    expect(route).toMatch(/export async function GET\(\)[\s\S]*try[\s\S]*catch/);
    expect(route).toContain("code: 'facility_list_load_failed'");
    expect(route).toContain('retryable: true');
  });

  it('preserves the page shell, heading, add action, Vietnamese error, and local retry', () => {
    const page = read('app/admin/facilities/page.tsx');
    expect(page).toContain('<AdminPage>');
    expect(page).toContain('Danh Sách Cơ Sở');
    expect(page).toContain('Thêm Cơ Sở Mới');
    expect(page).toContain('Không thể tải danh sách cơ sở làm việc.');
    expect(page).toContain("'Thử lại'");
  });

  it('keeps the runtime flag authoritative for mutation capability', () => {
    const service = read('services/server/adminFacilities.ts');
    expect(service).toContain('directory.canPersistStatusAndCode && isFacilityActiveStateEnabled()');
  });

  it('keeps employee core data when request-scoped facility enrichment fails', () => {
    const service = read('services/server/adminEmployeeData.ts');
    expect(service).toContain('loadFacilityDirectory(supabase).then');
    expect(service).toContain("facilities: [] as FacilityDirectoryItem[]");
    expect(service).toContain("['employee_enrichment_failed']");
    expect(service).toContain("'employee_facility_enrichment_failed'");
  });

  it('provides a draft-only SELECT policy package without rewriting legacy assignments', () => {
    const forward = read('supabase/drafts/20260728_facility_directory_rls_forward.sql');
    expect(forward).toMatch(/for select\s+to authenticated/i);
    expect(forward).not.toMatch(/update\s+public\.employees|delete\s+from\s+public\.employees/i);
    expect(forward).not.toMatch(/create policy[\s\S]*for (insert|update|delete|all)/i);
  });
});
