import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  PHASE_ACTIONS,
  PhaseAuthorizationModelError,
  canGlobalProjectManagerPerformPhaseAction,
  canProjectRolePerformPhaseAction,
  isCancelledProjectStatus,
  isPhaseAction,
  resolveSingleActiveProjectRole,
} from '../services/server/phaseAuthorizationCore';

const repositoryRoot = join(__dirname, '..');

function source(relativePath: string): string {
  return readFileSync(join(repositoryRoot, relativePath), 'utf8');
}

describe('phase mutation membership authorization', () => {
  it('keeps phase actions controlled by a shared enum', () => {
    expect(PHASE_ACTIONS).toEqual([
      'PHASE_VIEW',
      'PHASE_CREATE',
      'PHASE_EDIT',
      'PHASE_ASSIGN',
      'PHASE_DEADLINE',
      'PHASE_REORDER',
      'PHASE_TRANSITION',
      'PHASE_COMPLETE',
      'PHASE_REOPEN',
      'PHASE_SKIP',
      'PHASE_CANCEL',
      'PHASE_OVERRIDE_LOCK',
    ]);
    expect(isPhaseAction('PHASE_CREATE')).toBe(true);
    expect(isPhaseAction('PHASE_DELETE')).toBe(false);
  });

  it('allows global project managers to perform all phase actions', () => {
    PHASE_ACTIONS.forEach((action) => {
      expect(canGlobalProjectManagerPerformPhaseAction(action)).toBe(true);
    });
  });

  it('allows project owners and project managers to mutate phases', () => {
    const mutationActions = PHASE_ACTIONS.filter((action) => action !== 'PHASE_VIEW');

    mutationActions.forEach((action) => {
      expect(canProjectRolePerformPhaseAction('PROJECT_OWNER', action)).toBe(true);
      expect(canProjectRolePerformPhaseAction('PROJECT_MANAGER', action)).toBe(true);
    });
  });

  it('denies creative leads and contributors for phase mutations in this slice', () => {
    const mutationActions = PHASE_ACTIONS.filter((action) => action !== 'PHASE_VIEW');

    expect(canProjectRolePerformPhaseAction('CREATIVE_LEAD', 'PHASE_VIEW')).toBe(true);
    expect(canProjectRolePerformPhaseAction('CONTRIBUTOR', 'PHASE_VIEW')).toBe(true);

    mutationActions.forEach((action) => {
      expect(canProjectRolePerformPhaseAction('CREATIVE_LEAD', action)).toBe(false);
      expect(canProjectRolePerformPhaseAction('CONTRIBUTOR', action)).toBe(false);
    });
  });

  it('uses only one active project membership role and blocks revoked or duplicate matches', () => {
    expect(resolveSingleActiveProjectRole([
      { role_code: 'PROJECT_OWNER', status: 'REVOKED' },
    ])).toBeNull();
    expect(resolveSingleActiveProjectRole([
      { role_code: 'PROJECT_MANAGER', status: 'ACTIVE' },
    ])).toBe('PROJECT_MANAGER');
    expect(() => resolveSingleActiveProjectRole([
      { role_code: 'PROJECT_OWNER', status: 'ACTIVE' },
      { role_code: 'PROJECT_MANAGER', status: 'ACTIVE' },
    ])).toThrow(PhaseAuthorizationModelError);
    expect(() => resolveSingleActiveProjectRole([
      { role_code: 'PROJECT_MANAGER', status: 'ACTIVE' },
      { role_code: 'PROJECT_MANAGER', status: 'ACTIVE' },
    ])).toThrow(PhaseAuthorizationModelError);
    expect(() => resolveSingleActiveProjectRole([
      { role_code: 'LEGACY_MANAGER', status: 'ACTIVE' },
    ])).toThrow(PhaseAuthorizationModelError);
  });

  it('treats CANCELLED projects as closed for mutation authorization', () => {
    expect(isCancelledProjectStatus('CANCELLED')).toBe(true);
    expect(isCancelledProjectStatus('cancelled')).toBe(true);
    expect(isCancelledProjectStatus('PROCESSING')).toBe(false);
  });

  it('routes phase APIs through the centralized server authorization helper', () => {
    const createRoute = source('app/api/admin/projects/[projectId]/phases/route.ts');
    const updateRoute = source('app/api/admin/projects/[projectId]/phases/[phaseId]/route.ts');
    const statusRoute = source('app/api/admin/projects/[projectId]/phases/[phaseId]/status/route.ts');
    const listRoute = source('app/api/admin/phases/route.ts');
    const service = source('services/server/phaseMutations.ts');
    const authorization = source('services/server/phaseAuthorization.ts');

    expect(createRoute).toMatch(/createPhase/);
    expect(updateRoute).toMatch(/updatePhase/);
    expect(statusRoute).toMatch(/updatePhaseStatus/);
    expect(listRoute).toMatch(/listPhases/);
    expect(service).toMatch(/requirePhaseMutationAccess/);
    expect(service).not.toMatch(/requireWorkspaceAccess\('ADMIN_WORKSPACE'\)/);
    expect(service).not.toMatch(/hasPermission\(authContext, 'PROJECT_MANAGE'\)/);
    expect(authorization).toMatch(/requireAuthenticatedEmployee/);
    expect(authorization).toMatch(/hasWorkspaceAccess\(authContext, 'ADMIN_WORKSPACE'\)/);
    expect(authorization).toMatch(/hasPermission\(authContext, 'PROJECT_MANAGE'\)/);
    expect(authorization).toMatch(/from\('project_members'\)/);
    expect(authorization).toMatch(/resolveSingleActiveProjectRole/);
  });

  it('keeps phase status persistence behind live approval, RPC atomicity, and audit history', () => {
    const service = source('services/server/phaseMutations.ts');
    const statusRoute = source('app/api/admin/projects/[projectId]/phases/[phaseId]/status/route.ts');

    expect(statusRoute).toMatch(/updatePhaseStatus/);
    expect(service).toMatch(/const UPDATE_PHASE_STATUS_KEYS = new Set\(\['action', 'reason', 'note', 'expectedCurrentStatus'\]\)/);
    expect(service).toMatch(/PHASE_STATUS_MUTATION_ENABLED/);
    expect(service).toMatch(/LIVE_APPROVAL_REQUIRED/);
    expect(service).toMatch(/from\('phase_status_history'\)\.select\('id'\)/);
    expect(service).toMatch(/nextProjectPhaseStatus/);
    expect(service).toMatch(/from\('tasks'\)\s*\.select\('id, status'\)/);
    expect(service).toMatch(/rpc\('transition_project_phase_status'/);
    expect(service).toMatch(/p_old_status: phase\.status/);
    expect(service).toMatch(/p_new_status: nextStatus/);
    expect(service).not.toMatch(/from\('phase_status_history'\)\s*\.insert/);
  });

  it('checks project, phase ownership, cancellation, and membership before mutation', () => {
    const service = source('services/server/phaseMutations.ts');
    const authorization = source('services/server/phaseAuthorization.ts');
    const createAuthIndex = service.indexOf("requirePhaseMutationAccess({ projectId, action: 'PHASE_CREATE' })");
    const insertIndex = service.indexOf(".from('phases')\n    .insert");
    const updateAuthIndex = service.indexOf('requirePhaseMutationAccess({ projectId, phaseId, action })');
    const updateIndex = service.indexOf(".from('phases')\n    .update");

    expect(createAuthIndex).toBeGreaterThan(-1);
    expect(insertIndex).toBeGreaterThan(createAuthIndex);
    expect(updateAuthIndex).toBeGreaterThan(-1);
    expect(updateIndex).toBeGreaterThan(updateAuthIndex);
    expect(authorization).toMatch(/select\('id, status'\)/);
    expect(authorization).toMatch(/isCancelledProjectStatus\(project\.status\)/);
    expect(authorization).toMatch(/select\('id, project_id'\)/);
    expect(authorization).toMatch(/phase_project_mismatch/);
    expect(service).toMatch(/\.eq\('id', phaseId\)\s*\.eq\('project_id', projectId\)/);
  });

  it('keeps future assignment authorization tied to active employees and active project membership', () => {
    const authorization = source('services/server/phaseAuthorization.ts');

    expect(authorization).toMatch(/targetAssigneeEmployeeId\?: number/);
    expect(authorization).toMatch(/action === 'PHASE_ASSIGN'/);
    expect(authorization).toMatch(/assertAssignableProjectMember\(projectId, targetAssigneeEmployeeId\)/);
    expect(authorization).toMatch(/from\('employees'\)\s*\.select\('id, status, is_active'\)/);
    expect(authorization).toMatch(/isActiveAssignableEmployee/);
    expect(authorization).toMatch(/from\('project_members'\)\s*\.select\('role_code, status'\)/);
    expect(authorization).toMatch(/assignee_active_project_member/);
    expect(authorization).not.toMatch(/email.*targetAssignee|full_name.*targetAssignee|assigned_to.*targetAssignee/);
  });

  it('rejects client-supplied authority and cross-project identifiers in phase payloads', () => {
    const service = source('services/server/phaseMutations.ts');

    expect(service).toMatch(/const CREATE_PHASE_KEYS = new Set\(\['phaseName', 'orderIndex'\]\)/);
    expect(service).toMatch(/const UPDATE_PHASE_KEYS = new Set\(\['phaseName', 'orderIndex'\]\)/);
    expect(service).toMatch(/assertKnownFields\(body, CREATE_PHASE_KEYS\)/);
    expect(service).toMatch(/assertKnownFields\(body, UPDATE_PHASE_KEYS\)/);
    expect(service).not.toMatch(/body\.projectId(?!s)|body\.phaseId|body\.actorEmployeeId|body\.role|body\.permission|body\.membershipId/);
  });

  it('keeps raw database errors out of route responses', () => {
    const createRoute = source('app/api/admin/projects/[projectId]/phases/route.ts');
    const updateRoute = source('app/api/admin/projects/[projectId]/phases/[phaseId]/route.ts');
    const listRoute = source('app/api/admin/phases/route.ts');
    const routeSource = `${createRoute}\n${updateRoute}\n${listRoute}`;

    expect(routeSource).not.toMatch(/supabase_error_code|supabase_error_message|supabase_error_hint|supabase_error_details/);
  });

  it('keeps browser phase mutations out of the workflow repository and preserves legacy task flow', () => {
    const repository = source('services/repositories/workflowRepository.ts');

    expect(repository).toMatch(/\/api\/admin\/projects\/\$\{params\.projectId\}\/phases/);
    expect(repository).toMatch(/\/api\/admin\/projects\/\$\{params\.projectId\}\/phases\/\$\{params\.phaseId\}/);
    expect(repository).not.toMatch(/from\(['"]phases['"]\)\.insert/);
    expect(repository).not.toMatch(/from\(['"]phases['"]\)\.update/);
    expect(repository).toMatch(/from\('tasks'\)\.insert\(legacyTasks\)/);
    expect(repository).toMatch(/select\('id, project_name, assigned_to, current_phase, estimation_date, issue_note, packer_assigned, created_at'\)/);
  });

  it('does not regress project read RLS and project membership artifacts', () => {
    const projectRls = source('supabase/migrations/20260716035555_project_rls_pre_run_review.sql');
    const membership = source('supabase/migrations/20260714045636_project_members_foundation.sql');

    expect(projectRls).toMatch(/create or replace function public\.can_view_project/);
    expect(projectRls).toMatch(/create or replace function public\.has_project_role/);
    expect(projectRls).toMatch(/create policy "projects project access select"/);
    expect(membership).toMatch(/create table if not exists public\.project_members/);
    expect(membership).toMatch(/project_members_one_active_role/);
    expect(membership).toMatch(/PROJECT_OWNER/);
    expect(membership).toMatch(/PROJECT_MANAGER/);
    expect(membership).toMatch(/CREATIVE_LEAD/);
    expect(membership).toMatch(/CONTRIBUTOR/);
  });
});
