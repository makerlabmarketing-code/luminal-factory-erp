import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

function source(file: string) {
  return fs.readFileSync(path.join(process.cwd(), file), 'utf8');
}

describe('project membership management static contracts', () => {
  it('exposes list/add/update/revoke routes without hard delete', () => {
    expect(source('app/api/admin/projects/[projectId]/members/route.ts')).toMatch(/GET/);
    expect(source('app/api/admin/projects/[projectId]/members/route.ts')).toMatch(/POST/);
    expect(source('app/api/admin/projects/[projectId]/members/[membershipId]/route.ts')).toMatch(/PATCH/);
    expect(source('app/api/admin/projects/[projectId]/members/[membershipId]/revoke/route.ts')).toMatch(/POST/);
    expect(source('services/server/projectMembershipManagement.ts')).not.toMatch(/\.delete\(/);
  });

  it('derives actor fields server-side and rejects unknown client fields', () => {
    const service = source('services/server/projectMembershipManagement.ts');
    expect(service).toMatch(/granted_by_employee_id: auth\.actorEmployeeId/);
    expect(service).toMatch(/revoked_by_employee_id: auth\.actorEmployeeId/);
    expect(service).toMatch(/assertKnownFields/);
    expect(service).not.toMatch(/created_by|updated_by|auth_user_id/);
  });

  it('blocks duplicate active membership, inactive employees and cross-project membership ids', () => {
    const service = source('services/server/projectMembershipManagement.ts');
    expect(service).toMatch(/assertNoActiveMembership/);
    expect(service).toMatch(/isActiveEmployeeRow/);
    expect(service).toMatch(/Number\(membership\.project_id\) !== projectId/);
  });

  it('keeps UI lazy employee loading out of initial project load', () => {
    const page = source('app/admin/projects/[projectId]/page.tsx');
    const loadDataBody = page.slice(page.indexOf('const loadData'), page.indexOf('const projectItems'));
    expect(loadDataBody).not.toMatch(/scope=candidates|\/api\/admin\/employees/);
    expect(page).toMatch(/loadCandidateEmployees/);
    expect(page).toMatch(/scope=candidates/);
    expect(page).toMatch(/setProjectCapabilities/);
    expect(page).toMatch(/Thành viên dự án/);
  });
});
