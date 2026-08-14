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
    expect(service).toMatch(/p_actor_employee_id: input\.actorEmployeeId/);
    expect(service).toMatch(/const correlationId = randomUUID\(\)/);
    expect(service).toMatch(/assertKnownFields/);
    expect(service).not.toMatch(/created_by|updated_by|auth_user_id/);
  });

  it('delegates duplicate, employee, owner, task and cross-project invariants to one transaction', () => {
    const service = source('services/server/projectMembershipManagement.ts');
    const migration = source('supabase/migrations/20260812090000_project_membership_atomic_mutations.sql');
    expect(service).toMatch(/\.rpc\('mutate_project_membership'/);
    expect(migration).toMatch(/project_members_one_active_employee/);
    expect(migration).toMatch(/project_membership_employee_inactive/);
    expect(migration).toMatch(/project_membership_last_owner/);
    expect(migration).toMatch(/project_membership_active_tasks/);
    expect(migration).toMatch(/pm\.id = p_membership_id[\s\S]*pm\.project_id = p_project_id/);
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

describe('project membership atomic mutation delivery', () => {
  it('keeps the runtime gate default-closed and exposes it only after the authorized read model', () => {
    const service = source('services/server/projectMembershipManagement.ts');
    const route = source('app/api/admin/projects/[projectId]/members/route.ts');
    expect(service).toMatch(/PROJECT_MEMBERSHIP_ATOMIC_MUTATIONS_ENABLED/);
    expect(service).toMatch(/=== 'true'/);
    expect(route).toMatch(/getProjectMembershipReadModel\(params\.projectId\)/);
    expect(route).toMatch(/atomicMutationsEnabled: isProjectMembershipAtomicMutationEnabled\(\)/);
  });

  it('requires a reason and replaces prompt-based mutation UI with accessible dialogs', () => {
    const page = source('app/admin/projects/[projectId]/page.tsx');
    expect(page).toMatch(/reason: addMemberReason/);
    expect(page).toMatch(/reason: memberMutationReason/);
    expect(page).toMatch(/role="dialog"/);
    expect(page).toMatch(/minLength=\{10\}/);
    expect(page).not.toMatch(/window\.prompt/);
  });

  it('keeps the audit immutable and the RPC service-role only', () => {
    const migration = source('supabase/migrations/20260812090000_project_membership_atomic_mutations.sql');
    expect(migration).toMatch(/project_membership_audit_immutable/);
    expect(migration).toMatch(/before_state jsonb not null/);
    expect(migration).toMatch(/after_state jsonb not null/);
    expect(migration).toMatch(/correlation_id uuid not null unique/);
    expect(migration).toMatch(/revoke all on function[\s\S]*public, anon, authenticated/);
    expect(migration).toMatch(/grant execute on function[\s\S]*to service_role/);
    expect(migration).toMatch(/revoke insert, update, delete on public\.project_members from authenticated/);
  });
});


it('marks listed project members assignable only when the joined employee remains eligible', () => {
  const service = source('services/server/projectMembershipManagement.ts');
  const detailPage = source('app/admin/projects/[projectId]/page.tsx');

  expect(service).toMatch(/employees!project_members_employee_id_fkey\(id, full_name, title, status, is_active\)/);
  expect(service).toMatch(/isAssignable: row\.status === 'ACTIVE' && isActiveEmployeeRow\(employee\)/);
  expect(service).toMatch(/'DISABLED', 'DELETED'/);
  expect(detailPage).toMatch(/member\.status === 'ACTIVE' && member\.isAssignable/);
});
