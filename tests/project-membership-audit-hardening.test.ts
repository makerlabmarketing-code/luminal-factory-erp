import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(path, 'utf8');

describe('Project Membership Slice 4 audit and completion hardening', () => {
  it('protects the audit endpoint with server authorization, runtime gate and no-store', () => {
    const service = source('services/server/projectMembershipManagement.ts');
    const route = source('app/api/admin/projects/[projectId]/members/audit/route.ts');

    const auditBody = service.slice(
      service.indexOf('export async function listProjectMembershipAudit'),
      service.indexOf("type AtomicMembershipOperation")
    );
    expect(auditBody.indexOf("requireProjectMembershipAction(projectId, 'MEMBER_ADD')"))
      .toBeLessThan(auditBody.indexOf('requireAtomicMutationGate()'));
    expect(route).toMatch(/Cache-Control', 'no-store'/);
    expect(route).toMatch(/listProjectMembershipAudit/);
    expect(route).toMatch(/projectMembershipErrorResponse/);
  });

  it('uses bounded cursor pagination and batches employee display-name loading', () => {
    const service = source('services/server/projectMembershipManagement.ts');
    expect(service).toMatch(/requestedLimit > 50/);
    expect(service).toMatch(/\.limit\(requestedLimit \+ 1\)/);
    expect(service).toMatch(/if \(cursor\) auditQuery = auditQuery\.lt\('id', cursor\)/);
    expect(service).toMatch(/employeeIds = Array\.from\(new Set/);
    expect(service).toMatch(/\.from\('employees'\)\.select\('id, full_name'\)\.in\('id', employeeIds\)/);
  });

  it('reports owner, duplicate membership and orphan active-task integrity without raw records', () => {
    const service = source('services/server/projectMembershipManagement.ts');
    expect(service).toMatch(/duplicateActiveEmployeeCount/);
    expect(service).toMatch(/activeTaskWithoutMembershipCount/);
    expect(service).toMatch(/activeOwnerCount > 0/);
    expect(service).not.toMatch(/password|access_token|refresh_token/i);
  });

  it('lazy-loads the timeline, blocks duplicate requests and preserves loaded events on failure', () => {
    const component = source('app/admin/projects/[projectId]/ProjectMembershipAuditSection.tsx');
    expect(component).toMatch(/if \(nextExpanded && !loaded\) void loadAudit\(\)/);
    expect(component).toMatch(/if \(loadLockRef\.current/);
    expect(component).toMatch(/setEvents\(\(current\) => cursor \? \[\.\.\.current, \.\.\.payload\.events\] : payload\.events\)/);
    expect(component).toMatch(/Dữ liệu hiện tại vẫn được giữ lại/);
    expect(component).toMatch(/Mã đối chiếu/);
  });
});
