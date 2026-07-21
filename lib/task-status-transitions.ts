import type { TaskAssignmentStatus } from '@/lib/types/task-assignment';

export const TASK_STATUS_TRANSITIONS: Readonly<Record<TaskAssignmentStatus, readonly TaskAssignmentStatus[]>> = {
  BACKLOG: ['READY', 'CANCELLED'],
  READY: ['IN_PROGRESS', 'BACKLOG', 'CANCELLED'],
  IN_PROGRESS: ['PENDING_REVIEW', 'BLOCKED', 'ON_HOLD', 'CANCELLED'],
  PENDING_REVIEW: ['APPROVED', 'REVISION_REQUIRED', 'CANCELLED'],
  REVISION_REQUIRED: ['IN_PROGRESS', 'CANCELLED'],
  APPROVED: ['COMPLETED'],
  BLOCKED: ['IN_PROGRESS', 'CANCELLED'],
  ON_HOLD: ['READY', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

export function canTransitionTaskStatus(currentStatus: TaskAssignmentStatus, nextStatus: TaskAssignmentStatus): boolean {
  if (currentStatus === nextStatus) return true;
  return TASK_STATUS_TRANSITIONS[currentStatus].includes(nextStatus);
}

export function allowedNextTaskStatuses(currentStatus: TaskAssignmentStatus): readonly TaskAssignmentStatus[] {
  return [currentStatus, ...TASK_STATUS_TRANSITIONS[currentStatus]];
}
