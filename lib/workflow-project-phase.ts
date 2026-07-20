import type { TaskAssignmentStatus } from '@/lib/types/task-assignment';

export type ProjectPhaseStatus = 'ACTIVE' | 'LOCKED' | 'COMPLETED' | 'BLOCKED' | 'REVIEW' | 'CANCELLED';

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

export const TASK_STATUS_TRANSITIONS: Readonly<Record<TaskAssignmentStatus, readonly TaskAssignmentStatus[]>> = {
  BACKLOG: ['READY', 'CANCELLED'],
  READY: ['IN_PROGRESS', 'ON_HOLD', 'CANCELLED'],
  IN_PROGRESS: ['PENDING_REVIEW', 'BLOCKED', 'ON_HOLD', 'CANCELLED'],
  PENDING_REVIEW: ['APPROVED', 'REVISION_REQUIRED', 'CANCELLED'],
  REVISION_REQUIRED: ['IN_PROGRESS', 'CANCELLED'],
  APPROVED: ['COMPLETED', 'REVISION_REQUIRED'],
  BLOCKED: ['IN_PROGRESS', 'ON_HOLD', 'CANCELLED'],
  ON_HOLD: ['READY', 'IN_PROGRESS', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

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

export function canTransitionTaskStatus(currentStatus: TaskAssignmentStatus, nextStatus: TaskAssignmentStatus): boolean {
  if (currentStatus === nextStatus) return true;
  return TASK_STATUS_TRANSITIONS[currentStatus].includes(nextStatus);
}

export function allowedNextTaskStatuses(currentStatus: TaskAssignmentStatus): readonly TaskAssignmentStatus[] {
  return [currentStatus, ...TASK_STATUS_TRANSITIONS[currentStatus]];
}

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
