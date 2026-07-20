export type TaskAssignmentStatus =
  | 'BACKLOG'
  | 'READY'
  | 'IN_PROGRESS'
  | 'PENDING_REVIEW'
  | 'REVISION_REQUIRED'
  | 'APPROVED'
  | 'BLOCKED'
  | 'ON_HOLD'
  | 'COMPLETED'
  | 'CANCELLED';

export type TaskAssignmentActivityType =
  | 'TASK_CREATED'
  | 'TASK_UPDATED'
  | 'TASK_ASSIGNED'
  | 'STATUS_CHANGED'
  | 'COMMENT_ADDED';

export interface TaskAssignmentMemberOptionDTO {
  employeeId: number;
  fullName: string;
  title: string | null;
  roleCode: string;
}

export interface TaskAssignmentDTO {
  taskId: number;
  projectId: number;
  phaseId: number | null;
  parentTaskId: number | null;
  title: string;
  description: string | null;
  assigneeEmployeeId: number | null;
  assigneeFullName: string | null;
  deadline: string | null;
  status: TaskAssignmentStatus;
  progressPercent: number;
  commentCount: number;
  lastActivityAt: string | null;
}

export interface TaskAssignmentCreatePayload {
  title: string;
  description?: string | null;
  phaseId?: number | null;
  parentTaskId?: number | null;
  assigneeEmployeeId?: number | null;
  deadline?: string | null;
  comment?: string | null;
}

export interface TaskAssignmentUpdatePayload {
  title?: string;
  description?: string | null;
  phaseId?: number | null;
  parentTaskId?: number | null;
  deadline?: string | null;
  comment?: string | null;
}

export interface TaskAssignmentAssignPayload {
  assigneeEmployeeId: number | null;
  comment?: string | null;
}

export interface TaskAssignmentStatusPayload {
  status: TaskAssignmentStatus;
  comment?: string | null;
}

export interface TaskAssignmentRepository {
  listProjectTasks(projectId: number): Promise<TaskAssignmentDTO[]>;
  createProjectTask(projectId: number, payload: TaskAssignmentCreatePayload): Promise<TaskAssignmentDTO>;
  updateProjectTask(projectId: number, taskId: number, payload: TaskAssignmentUpdatePayload): Promise<TaskAssignmentDTO>;
  assignProjectTask(projectId: number, taskId: number, payload: TaskAssignmentAssignPayload): Promise<TaskAssignmentDTO>;
  changeProjectTaskStatus(projectId: number, taskId: number, payload: TaskAssignmentStatusPayload): Promise<TaskAssignmentDTO>;
  listAssignableMembers(projectId: number): Promise<TaskAssignmentMemberOptionDTO[]>;
}
