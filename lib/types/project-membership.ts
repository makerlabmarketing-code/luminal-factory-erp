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
}
