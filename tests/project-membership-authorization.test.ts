import { describe, expect, it } from 'vitest';
import {
  canProjectMembershipPerformAction,
  capabilitiesForProjectRole,
  resolveSingleActiveProjectMembershipRole,
} from '../services/server/projectMembershipAuthorizationCore';

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
});
