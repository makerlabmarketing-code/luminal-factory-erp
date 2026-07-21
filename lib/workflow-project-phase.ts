import type { TaskAssignmentStatus } from '@/lib/types/task-assignment';
export { TASK_STATUS_TRANSITIONS, allowedNextTaskStatuses, canTransitionTaskStatus } from './task-status-transitions';

export type ProjectPhaseStatus = 'ACTIVE' | 'LOCKED' | 'COMPLETED' | 'BLOCKED' | 'REVIEW' | 'CANCELLED';
export type ProjectPhaseStatusAction = 'COMPLETE' | 'LOCK' | 'UNLOCK' | 'REOPEN' | 'SKIP' | 'CANCEL' | 'OVERRIDE_LOCK';

export interface ProjectPhaseTransitionInput {
  currentStatus: ProjectPhaseStatus;
  action: ProjectPhaseStatusAction;
  previousPhaseStatus?: ProjectPhaseStatus | null;
  nextPhaseStatus?: ProjectPhaseStatus | null;
  taskCount: number;
  completedTaskCount: number;
  override: boolean;
}

export interface ProjectPhaseGateInput {
  status: ProjectPhaseStatus;
  taskCount: number;
  completedTaskCount: number;
  orderIndex: number;
}

export interface ProjectPhaseGateState {
  canEditPhase: boolean;
  canEditTasks: boolean;
  canCompletePhase: boolean;
  gatingMessage: string | null;
}

const TASK_PROGRESS_BY_STATUS: Readonly<Record<TaskAssignmentStatus, number>> = {
  BACKLOG: 0,
  READY: 10,
  IN_PROGRESS: 50,
  PENDING_REVIEW: 80,
  REVISION_REQUIRED: 60,
  APPROVED: 90,
  BLOCKED: 40,
  ON_HOLD: 30,
  COMPLETED: 100,
  CANCELLED: 0,
};

export function taskProgressPercent(status: TaskAssignmentStatus): number {
  return TASK_PROGRESS_BY_STATUS[status] ?? 0;
}

export function calculatePhaseProgress(taskProgressValues: readonly number[], isCompleted: boolean): number {
  if (isCompleted) return 100;
  if (taskProgressValues.length === 0) return 0;
  const total = taskProgressValues.reduce((sum, value) => sum + Math.max(0, Math.min(100, value)), 0);
  return Math.round(total / taskProgressValues.length);
}

export function calculateProjectProgress(phaseProgressValues: readonly number[]): number {
  if (phaseProgressValues.length === 0) return 0;
  const total = phaseProgressValues.reduce((sum, value) => sum + Math.max(0, Math.min(100, value)), 0);
  return Math.round(total / phaseProgressValues.length);
}

export function phaseGateState(input: ProjectPhaseGateInput, canManageProject: boolean): ProjectPhaseGateState {
  if (!canManageProject) {
    return { canEditPhase: false, canEditTasks: false, canCompletePhase: false, gatingMessage: 'Bạn chỉ có quyền xem giai đoạn này.' };
  }
  if (input.status === 'LOCKED') {
    return { canEditPhase: false, canEditTasks: false, canCompletePhase: false, gatingMessage: 'Hoàn thành giai đoạn trước để mở khóa.' };
  }
  if (input.status === 'CANCELLED') {
    return { canEditPhase: false, canEditTasks: false, canCompletePhase: false, gatingMessage: 'Giai đoạn đã hủy nên không thể chỉnh sửa.' };
  }
  if (input.status === 'COMPLETED') {
    return { canEditPhase: true, canEditTasks: true, canCompletePhase: false, gatingMessage: 'Giai đoạn đã hoàn thành. Chỉ sửa khi có lý do vận hành.' };
  }
  const canCompletePhase = input.taskCount > 0 && input.taskCount === input.completedTaskCount;
  return {
    canEditPhase: true,
    canEditTasks: true,
    canCompletePhase,
    gatingMessage: canCompletePhase ? 'Giai đoạn đủ điều kiện hoàn thành khi server có mutation được duyệt.' : 'Hoàn thành toàn bộ công việc con trước khi đóng giai đoạn.',
  };
}

export function isProjectPhaseStatus(value: unknown): value is ProjectPhaseStatus {
  return (
    value === 'ACTIVE' ||
    value === 'LOCKED' ||
    value === 'COMPLETED' ||
    value === 'BLOCKED' ||
    value === 'REVIEW' ||
    value === 'CANCELLED'
  );
}

export function isProjectPhaseStatusAction(value: unknown): value is ProjectPhaseStatusAction {
  return (
    value === 'COMPLETE' ||
    value === 'LOCK' ||
    value === 'UNLOCK' ||
    value === 'REOPEN' ||
    value === 'SKIP' ||
    value === 'CANCEL' ||
    value === 'OVERRIDE_LOCK'
  );
}

function previousDependencySatisfied(status?: ProjectPhaseStatus | null): boolean {
  return status === undefined || status === null || status === 'COMPLETED' || status === 'CANCELLED';
}

function allRequiredTasksComplete(taskCount: number, completedTaskCount: number): boolean {
  return taskCount > 0 && completedTaskCount >= taskCount;
}

export function nextProjectPhaseStatus(input: ProjectPhaseTransitionInput): ProjectPhaseStatus | null {
  if (input.currentStatus === 'CANCELLED') return null;

  if (input.action === 'OVERRIDE_LOCK') {
    return input.override ? 'ACTIVE' : null;
  }

  if (input.action === 'UNLOCK') {
    if (input.currentStatus !== 'LOCKED' && input.currentStatus !== 'BLOCKED') return null;
    return previousDependencySatisfied(input.previousPhaseStatus) ? 'ACTIVE' : null;
  }

  if (input.action === 'COMPLETE') {
    if (input.currentStatus !== 'ACTIVE' && input.currentStatus !== 'REVIEW') return null;
    return allRequiredTasksComplete(input.taskCount, input.completedTaskCount) ? 'COMPLETED' : null;
  }

  if (input.action === 'LOCK') {
    return input.currentStatus === 'ACTIVE' ? 'LOCKED' : null;
  }

  if (input.action === 'REOPEN') {
    if (input.currentStatus !== 'COMPLETED' && input.currentStatus !== 'REVIEW') return null;
    if (input.currentStatus === 'COMPLETED' && input.nextPhaseStatus === 'COMPLETED' && !input.override) return null;
    return previousDependencySatisfied(input.previousPhaseStatus) ? 'ACTIVE' : null;
  }

  if (input.action === 'SKIP') {
    if (input.currentStatus !== 'ACTIVE' && input.currentStatus !== 'LOCKED') return null;
    return previousDependencySatisfied(input.previousPhaseStatus) ? 'COMPLETED' : null;
  }

  if (input.action === 'CANCEL') {
    return input.currentStatus === 'ACTIVE' || input.currentStatus === 'BLOCKED' ? 'CANCELLED' : null;
  }

  return null;
}
