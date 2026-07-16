export type PhaseAction =
  | 'PHASE_VIEW'
  | 'PHASE_CREATE'
  | 'PHASE_EDIT'
  | 'PHASE_ASSIGN'
  | 'PHASE_DEADLINE'
  | 'PHASE_REORDER'
  | 'PHASE_TRANSITION'
  | 'PHASE_COMPLETE'
  | 'PHASE_REOPEN'
  | 'PHASE_SKIP'
  | 'PHASE_CANCEL'
  | 'PHASE_OVERRIDE_LOCK';

export type ProjectRoleCode =
  | 'PROJECT_OWNER'
  | 'PROJECT_MANAGER'
  | 'CREATIVE_LEAD'
  | 'CONTRIBUTOR';

export interface ProjectMembershipRoleRow {
  role_code?: string | null;
  status?: string | null;
}

export class PhaseAuthorizationModelError extends Error {
  code: 'duplicate_active_membership';

  constructor(code: 'duplicate_active_membership', message: string) {
    super(message);
    this.name = 'PhaseAuthorizationModelError';
    this.code = code;
  }
}

export const PHASE_ACTIONS: readonly PhaseAction[] = [
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
];

const PHASE_ACTION_SET = new Set<string>(PHASE_ACTIONS);

const OWNER_AND_MANAGER_ACTIONS = new Set<PhaseAction>([
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

const CREATIVE_LEAD_ACTIONS = new Set<PhaseAction>(['PHASE_VIEW']);
const CONTRIBUTOR_ACTIONS = new Set<PhaseAction>(['PHASE_VIEW']);

export function isPhaseAction(value: unknown): value is PhaseAction {
  return typeof value === 'string' && PHASE_ACTION_SET.has(value);
}

export function isProjectRoleCode(value: unknown): value is ProjectRoleCode {
  return (
    value === 'PROJECT_OWNER' ||
    value === 'PROJECT_MANAGER' ||
    value === 'CREATIVE_LEAD' ||
    value === 'CONTRIBUTOR'
  );
}

export function canProjectRolePerformPhaseAction(
  roleCode: ProjectRoleCode,
  action: PhaseAction
): boolean {
  if (roleCode === 'PROJECT_OWNER' || roleCode === 'PROJECT_MANAGER') {
    return OWNER_AND_MANAGER_ACTIONS.has(action);
  }

  if (roleCode === 'CREATIVE_LEAD') {
    return CREATIVE_LEAD_ACTIONS.has(action);
  }

  return CONTRIBUTOR_ACTIONS.has(action);
}

export function canGlobalProjectManagerPerformPhaseAction(action: PhaseAction): boolean {
  return PHASE_ACTION_SET.has(action);
}

export function isCancelledProjectStatus(status?: string | null): boolean {
  return String(status || '').trim().toUpperCase() === 'CANCELLED';
}

export function resolveSingleActiveProjectRole(
  rows: readonly ProjectMembershipRoleRow[]
): ProjectRoleCode | null {
  const activeRoles = rows
    .filter((row) => String(row.status || '').trim().toUpperCase() === 'ACTIVE')
    .map((row) => row.role_code)
    .filter(isProjectRoleCode);

  if (activeRoles.length > 1) {
    throw new PhaseAuthorizationModelError(
      'duplicate_active_membership',
      'More than one ACTIVE project membership role matched the actor.'
    );
  }

  return activeRoles[0] || null;
}
