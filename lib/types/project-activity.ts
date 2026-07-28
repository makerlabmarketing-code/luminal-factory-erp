export type ProjectActivityType =
  | 'TASK_ASSIGNEE_CHANGED'
  | 'TASK_REVIEWER_CHANGED'
  | 'TASK_DEADLINE_CHANGED'
  | 'TASK_STATUS_CHANGED'
  | 'TASK_PROGRESS_CHANGED'
  | 'TASK_PHASE_CHANGED'
  | 'PROJECT_MEMBER_ADDED'
  | 'PROJECT_MEMBER_ROLE_CHANGED'
  | 'PROJECT_MEMBER_REVOKED'
  | 'COMMENT_CREATED';

export interface ProjectCommentDTO {
  id: number;
  projectId: number;
  taskId: number | null;
  body: string;
  actorEmployeeId: number;
  actorName: string;
  createdAt: string;
}

export interface ProjectActivityDTO {
  id: number;
  projectId: number;
  taskId: number | null;
  activityType: ProjectActivityType;
  payload: Readonly<Record<string, unknown>>;
  actorEmployeeId: number;
  actorName: string;
  createdAt: string;
}

export interface ProjectTimelineDTO {
  comments: ProjectCommentDTO[];
  activity: ProjectActivityDTO[];
  nextCursor: string | null;
  capabilityEnabled: boolean;
  canComment: boolean;
}
