import { describe, expect, it } from 'vitest';
import {
  canProjectMembershipPerformAction,
  capabilitiesForProjectRole,
  resolveSingleActiveProjectMembershipRole,
} from '../services/server/projectMembershipAuthorizationCore';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repositoryRoot = join(__dirname, '..');

describe('project membership authorization core', () => {
  it('allows owner to manage project, members, phases and tasks', () => {
    expect(capabilitiesForProjectRole('PROJECT_OWNER')).toEqual({
      canViewProject: true,
      canEditProject: true,
      canManageMembers: true,
      canManagePhases: true,
      canManageTasks: true,
      canCancelProject: true,
    });
  });

  it('allows manager to manage members, phases and tasks without cancel authority', () => {
    expect(canProjectMembershipPerformAction('PROJECT_MANAGER', 'MEMBER_ADD')).toBe(true);
    expect(canProjectMembershipPerformAction('PROJECT_MANAGER', 'PHASE_MANAGE')).toBe(true);
    expect(canProjectMembershipPerformAction('PROJECT_MANAGER', 'PROJECT_CANCEL')).toBe(false);
  });

  it('keeps creative lead and contributor view-only', () => {
    for (const role of ['CREATIVE_LEAD', 'CONTRIBUTOR'] as const) {
      expect(canProjectMembershipPerformAction(role, 'PROJECT_VIEW')).toBe(true);
      expect(canProjectMembershipPerformAction(role, 'MEMBER_ADD')).toBe(false);
      expect(canProjectMembershipPerformAction(role, 'TASK_MANAGE')).toBe(false);
    }
  });

  it('allows admin project manage override through explicit server role', () => {
    expect(canProjectMembershipPerformAction('GLOBAL_PROJECT_MANAGE', 'MEMBER_REVOKE')).toBe(true);
    expect(canProjectMembershipPerformAction('GLOBAL_PROJECT_MANAGE', 'PROJECT_CANCEL')).toBe(true);
  });

  it('ignores revoked membership and rejects duplicate active memberships', () => {
    expect(resolveSingleActiveProjectMembershipRole([
      { role_code: 'PROJECT_OWNER', status: 'REVOKED' },
      { role_code: 'CONTRIBUTOR', status: 'ACTIVE' },
    ])).toBe('CONTRIBUTOR');
    expect(() => resolveSingleActiveProjectMembershipRole([
      { role_code: 'PROJECT_OWNER', status: 'ACTIVE' },
      { role_code: 'PROJECT_MANAGER', status: 'ACTIVE' },
    ])).toThrow(/Multiple ACTIVE/);
  });

  it('denies unknown actions and cancelled project mutations by default', () => {
    expect(canProjectMembershipPerformAction('PROJECT_OWNER', 'UNKNOWN_ACTION')).toBe(false);
    expect(canProjectMembershipPerformAction('PROJECT_OWNER', 'MEMBER_ADD', 'CANCELLED')).toBe(false);
    expect(canProjectMembershipPerformAction('PROJECT_OWNER', 'PROJECT_VIEW', 'CANCELLED')).toBe(true);
  });

  it('preserves project authorization failure categories and sanitizes API responses', () => {
    const authorization = readFileSync(join(repositoryRoot, 'services/server/projectMembershipAuthorization.ts'), 'utf8');
    const routes = [
      'app/api/admin/projects/route.ts',
      'app/api/admin/projects/[projectId]/route.ts',
      'app/api/admin/projects/[projectId]/archive/route.ts',
    ].map((path) => readFileSync(join(repositoryRoot, path), 'utf8')).join('\n');

    expect(authorization).toMatch(/employee_not_connected/);
    expect(authorization).toMatch(/employee_inactive/);
    expect(authorization).toMatch(/project_membership_required/);
    expect(authorization).toMatch(/project_forbidden/);
    expect(authorization).toMatch(/membership_lookup_failed/);
    expect(authorization).toMatch(/project_authorization_failed/);
    expect(authorization).toMatch(/project_not_found/);
    expect(routes).not.toMatch(/supabase_error_code/);
  });
});
