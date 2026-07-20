export type ProjectMembershipRoleCode = 'PROJECT_OWNER' | 'PROJECT_MANAGER' | 'CREATIVE_LEAD' | 'CONTRIBUTOR';
export type ProjectMembershipStatus = 'ACTIVE' | 'REVOKED';
export type ProjectMembershipAction =
  | 'PROJECT_VIEW'
  | 'PROJECT_EDIT'
  | 'PROJECT_CANCEL'
  | 'MEMBER_LIST'
  | 'MEMBER_ADD'
  | 'MEMBER_ROLE_CHANGE'
  | 'MEMBER_REVOKE'
  | 'PHASE_MANAGE'
  | 'TASK_MANAGE';

export interface ProjectMembershipCapabilities {
  canViewProject: boolean;
  canEditProject: boolean;
  canManageMembers: boolean;
  canManagePhases: boolean;
  canManageTasks: boolean;
  canCancelProject: boolean;
}

export interface ProjectMembershipRoleRow {
  role_code?: string | null;
  status?: string | null;
}

export class ProjectMembershipAuthorizationModelError extends Error {
  code: 'duplicate_active_membership' | 'invalid_active_membership_role' | 'unknown_action';

  constructor(code: ProjectMembershipAuthorizationModelError['code'], message: string) {
    super(message);
    this.name = 'ProjectMembershipAuthorizationModelError';
    this.code = code;
  }
}

export const PROJECT_MEMBERSHIP_ROLES: readonly ProjectMembershipRoleCode[] = [
  'PROJECT_OWNER',
  'PROJECT_MANAGER',
  'CREATIVE_LEAD',
  'CONTRIBUTOR',
];

export const PROJECT_MEMBERSHIP_STATUSES: readonly ProjectMembershipStatus[] = ['ACTIVE', 'REVOKED'];

export const PROJECT_MEMBERSHIP_ACTIONS: readonly ProjectMembershipAction[] = [
  'PROJECT_VIEW',
  'PROJECT_EDIT',
  'PROJECT_CANCEL',
  'MEMBER_LIST',
  'MEMBER_ADD',
  'MEMBER_ROLE_CHANGE',
  'MEMBER_REVOKE',
  'PHASE_MANAGE',
  'TASK_MANAGE',
];

const ROLE_SET = new Set<string>(PROJECT_MEMBERSHIP_ROLES);
const STATUS_SET = new Set<string>(PROJECT_MEMBERSHIP_STATUSES);
const ACTION_SET = new Set<string>(PROJECT_MEMBERSHIP_ACTIONS);

const ROLE_CAPABILITIES: Record<ProjectMembershipRoleCode, ProjectMembershipCapabilities> = {
  PROJECT_OWNER: {
    canViewProject: true,
    canEditProject: true,
    canManageMembers: true,
    canManagePhases: true,
    canManageTasks: true,
    canCancelProject: true,
  },
  PROJECT_MANAGER: {
    canViewProject: true,
    canEditProject: true,
    canManageMembers: true,
    canManagePhases: true,
    canManageTasks: true,
    canCancelProject: false,
  },
  CREATIVE_LEAD: {
    canViewProject: true,
    canEditProject: false,
    canManageMembers: false,
    canManagePhases: false,
    canManageTasks: false,
    canCancelProject: false,
  },
  CONTRIBUTOR: {
    canViewProject: true,
    canEditProject: false,
    canManageMembers: false,
    canManagePhases: false,
    canManageTasks: false,
    canCancelProject: false,
  },
};

export const EMPTY_PROJECT_MEMBERSHIP_CAPABILITIES: ProjectMembershipCapabilities = {
  canViewProject: false,
  canEditProject: false,
  canManageMembers: false,
  canManagePhases: false,
  canManageTasks: false,
  canCancelProject: false,
};

export const ADMIN_PROJECT_MEMBERSHIP_CAPABILITIES: ProjectMembershipCapabilities = {
  canViewProject: true,
  canEditProject: true,
  canManageMembers: true,
  canManagePhases: true,
  canManageTasks: true,
  canCancelProject: true,
};

export function isProjectMembershipRoleCode(value: unknown): value is ProjectMembershipRoleCode {
  return typeof value === 'string' && ROLE_SET.has(value);
}

export function isProjectMembershipStatus(value: unknown): value is ProjectMembershipStatus {
  return typeof value === 'string' && STATUS_SET.has(value);
}

export function isProjectMembershipAction(value: unknown): value is ProjectMembershipAction {
  return typeof value === 'string' && ACTION_SET.has(value);
}

export function isCancelledProjectStatus(status?: string | null): boolean {
  return String(status || '').trim().toUpperCase() === 'CANCELLED';
}

export function resolveSingleActiveProjectMembershipRole(
  rows: readonly ProjectMembershipRoleRow[]
): ProjectMembershipRoleCode | null {
  const activeRows = rows.filter((row) => String(row.status || '').trim().toUpperCase() === 'ACTIVE');
  const activeRoles = activeRows.map((row) => row.role_code);

  if (activeRoles.some((role) => !isProjectMembershipRoleCode(role))) {
    throw new ProjectMembershipAuthorizationModelError('invalid_active_membership_role', 'ACTIVE project membership role is invalid.');
  }

  if (activeRoles.length > 1) {
    throw new ProjectMembershipAuthorizationModelError('duplicate_active_membership', 'Multiple ACTIVE project memberships matched the actor.');
  }

  return (activeRoles[0] as ProjectMembershipRoleCode | undefined) ?? null;
}

export function capabilitiesForProjectRole(
  roleCode: ProjectMembershipRoleCode | 'GLOBAL_PROJECT_MANAGE' | null,
  projectStatus?: string | null
): ProjectMembershipCapabilities {
  const base = roleCode === 'GLOBAL_PROJECT_MANAGE'
    ? ADMIN_PROJECT_MEMBERSHIP_CAPABILITIES
    : roleCode
      ? ROLE_CAPABILITIES[roleCode]
      : EMPTY_PROJECT_MEMBERSHIP_CAPABILITIES;

  if (!isCancelledProjectStatus(projectStatus)) return { ...base };

  return {
    canViewProject: base.canViewProject,
    canEditProject: false,
    canManageMembers: false,
    canManagePhases: false,
    canManageTasks: false,
    canCancelProject: false,
  };
}

export function canProjectMembershipPerformAction(
  roleCode: ProjectMembershipRoleCode | 'GLOBAL_PROJECT_MANAGE' | null,
  action: unknown,
  projectStatus?: string | null
): boolean {
  if (!isProjectMembershipAction(action)) {
    return false;
  }

  const capabilities = capabilitiesForProjectRole(roleCode, projectStatus);
  const actionMap: Record<ProjectMembershipAction, keyof ProjectMembershipCapabilities> = {
    PROJECT_VIEW: 'canViewProject',
    PROJECT_EDIT: 'canEditProject',
    PROJECT_CANCEL: 'canCancelProject',
    MEMBER_LIST: 'canViewProject',
    MEMBER_ADD: 'canManageMembers',
    MEMBER_ROLE_CHANGE: 'canManageMembers',
    MEMBER_REVOKE: 'canManageMembers',
    PHASE_MANAGE: 'canManagePhases',
    TASK_MANAGE: 'canManageTasks',
  };

  return capabilities[actionMap[action]];
}

export function projectRoleLabel(roleCode: ProjectMembershipRoleCode): string {
  const labels: Record<ProjectMembershipRoleCode, string> = {
    PROJECT_OWNER: 'Chủ dự án',
    PROJECT_MANAGER: 'Quản lý dự án',
    CREATIVE_LEAD: 'Lead sáng tạo',
    CONTRIBUTOR: 'Thành viên',
  };

  return labels[roleCode];
}
