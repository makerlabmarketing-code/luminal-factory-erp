export type ProjectMembershipRoleCode =
  | 'PROJECT_OWNER'
  | 'PROJECT_MANAGER'
  | 'CREATIVE_LEAD'
  | 'CONTRIBUTOR';

export interface ProjectMemberDTO {
  membershipId: number;
  employeeId: number;
  fullName: string;
  title: string | null;
  roleCode: ProjectMembershipRoleCode;
  roleLabel: string;
  status: 'ACTIVE' | 'REVOKED';
  joinedAt: string | null;
  revokedAt: string | null;
  isAssignable: boolean;
}

export interface ProjectMembershipCapabilitiesDTO {
  canViewProject: boolean;
  canEditProject: boolean;
  canManageMembers: boolean;
  canManagePhases: boolean;
  canManageTasks: boolean;
  canCancelProject: boolean;
}

export interface ProjectMembershipSummaryDTO {
  projectId: number;
  projectCode: string;
  activeMemberCount: number;
  ownerCount: number;
  managerCount: number;
  creativeLeadCount: number;
  contributorCount: number;
  hasActiveOwner: boolean;
}

export interface ProjectMembershipResponseDTO {
  success: true;
  members: ProjectMemberDTO[];
  capabilities: ProjectMembershipCapabilitiesDTO;
  summary: ProjectMembershipSummaryDTO;
  atomicMutationsEnabled: boolean;
}

export type ProjectMembershipAuditOperation = 'ADD' | 'CHANGE_ROLE' | 'REVOKE';

export interface ProjectMembershipAuditDTO {
  auditId: number;
  membershipId: number;
  employeeId: number;
  employeeName: string;
  actorEmployeeId: number;
  actorName: string;
  operation: ProjectMembershipAuditOperation;
  reason: string;
  beforeRoleLabel: string | null;
  afterRoleLabel: string | null;
  correlationId: string;
  occurredAt: string;
}

export interface ProjectMembershipIntegrityDTO {
  activeMemberCount: number;
  activeOwnerCount: number;
  duplicateActiveEmployeeCount: number;
  activeTaskWithoutMembershipCount: number;
  healthy: boolean;
}

export interface ProjectMembershipAuditResponseDTO {
  success: true;
  events: ProjectMembershipAuditDTO[];
  integrity: ProjectMembershipIntegrityDTO;
  nextCursor: string | null;
}
