import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  GLOBAL_PROJECT_VIEW_CAPABILITIES,
  capabilitiesForProjectRole,
  canProjectMembershipPerformAction,
} from '../services/server/projectMembershipAuthorizationCore';

const root = join(__dirname, '..');
const source = (relativePath: string) => readFileSync(join(root, relativePath), 'utf8');

describe('Project Membership Slice 0 baseline contracts', () => {
  it('uses project_members employee_id as the stable membership identity', () => {
    const service = source('services/server/projectMembershipManagement.ts');
    const migration = source('supabase/migrations/20260714045636_project_members_foundation.sql');

    expect(service).toMatch(/employeeId/);
    expect(service).toMatch(/employee_id/);
    expect(service).not.toMatch(/body\.(fullName|email|authUserId|auth_user_id)/);
    expect(migration).toMatch(/foreign key \(employee_id\)\s+references public\.employees\(id\)\s+on update cascade\s+on delete restrict/);
  });

  it('keeps global view separate from project mutation capabilities', () => {
    expect(GLOBAL_PROJECT_VIEW_CAPABILITIES).toEqual({
      canViewProject: true,
      canEditProject: false,
      canManageMembers: false,
      canManagePhases: false,
      canManageTasks: false,
      canCancelProject: false,
    });
    expect(canProjectMembershipPerformAction('PROJECT_MANAGER', 'MEMBER_ADD')).toBe(true);
    expect(canProjectMembershipPerformAction('CREATIVE_LEAD', 'MEMBER_ADD')).toBe(false);
    expect(capabilitiesForProjectRole('CONTRIBUTOR').canViewProject).toBe(true);
    expect(capabilitiesForProjectRole('CONTRIBUTOR').canManageTasks).toBe(false);
  });

  it('keeps membership history soft-revoked and server-authorized', () => {
    const service = source('services/server/projectMembershipManagement.ts');
    const migration = source('supabase/migrations/20260812090000_project_membership_atomic_mutations.sql');
    const routes = source('app/api/admin/projects/[projectId]/members/route.ts')
      + source('app/api/admin/projects/[projectId]/members/[membershipId]/route.ts')
      + source('app/api/admin/projects/[projectId]/members/[membershipId]/revoke/route.ts');

    expect(service).toMatch(/operation: 'REVOKE'/);
    expect(service).toMatch(/\.rpc\('mutate_project_membership'/);
    expect(service).not.toMatch(/\.delete\(/);
    expect(service).toMatch(/requireProjectMembershipAction/);
    expect(routes).toMatch(/export async function POST/);
    expect(migration).toMatch(/set status = 'REVOKED'/);
    expect(migration).toMatch(/project_membership_audit/);
    expect(migration).toMatch(/revoke insert, update, delete on public\.project_members from authenticated/);
  });

  it('preserves the compatibility create boundary and its partial-membership warning', () => {
    const service = source('services/server/projectMutations.ts');
    const page = source('app/admin/projects/page.tsx');

    expect(service).toMatch(/PROJECT_WORKFLOW_ATOMIC_CREATE_ENABLED/);
    expect(service).toMatch(/managerMembershipCreated/);
    expect(service).toMatch(/Dự án đã được tạo nhưng chưa thể thêm người phụ trách/);
    expect(page).toMatch(/result\.warnings\.length > 0/);
  });

  it('deduplicates project creation employee loads and mutation submits', () => {
    const page = source('app/admin/projects/page.tsx');

    expect(page).toMatch(/creationOptionsPromiseRef/);
    expect(page).toMatch(/creationOptionsLoadedRef/);
    expect(page).toMatch(/createProjectLockRef/);
    expect(page).toMatch(/void request\.catch\(\(\) => undefined\)/);
    expect(page).toMatch(/if \(createProjectLockRef\.current\) return/);
    expect(page).toMatch(/if \(isCreatingProject\) return/);
  });

  it('deduplicates membership candidate loading and member mutations', () => {
    const page = source('app/admin/projects/[projectId]/page.tsx');

    expect(page).toMatch(/candidateLoadPromiseRef/);
    expect(page).toMatch(/memberMutationLockRef/);
    expect(page).toMatch(/if \(candidateLoadPromiseRef\.current\) return candidateLoadPromiseRef\.current/);
    expect(page).toMatch(/if \(!canManageMembers \|\| memberActionLoading \|\| memberMutationLockRef\.current\) return/);
  });

  it('keeps the read-only operator package separate from migrations', () => {
    const validation = source('supabase/validation/20260805_project_membership_baseline_readonly.sql');
    const migrationFiles = source('supabase/migrations/20260714045636_project_members_foundation.sql');

    expect(validation).toMatch(/READ-ONLY/);
    expect(validation).toMatch(/active duplicate employee roles/);
    expect(validation).toMatch(/normalized project code state/);
    expect(validation).toMatch(/membership audit columns/);
    expect(migrationFiles).not.toMatch(/20260805/);
  });
});
