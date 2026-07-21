import type { TaskAssignmentDTO, TaskAssignmentStatus } from '@/lib/types/task-assignment';

export interface TaskEditIntentInput {
  currentTask: Pick<TaskAssignmentDTO, 'assigneeEmployeeId' | 'deadline' | 'status'>;
  nextAssigneeEmployeeId: number | null;
  nextDeadline: string | null;
  nextStatus: TaskAssignmentStatus;
}

export interface TaskEditIntent {
  hasAssigneeChange: boolean;
  hasDeadlineChange: boolean;
  hasStatusChange: boolean;
  changedLabels: string[];
}

export function describeTaskEditIntent(input: TaskEditIntentInput): TaskEditIntent {
  const hasAssigneeChange = input.currentTask.assigneeEmployeeId !== input.nextAssigneeEmployeeId;
  const hasDeadlineChange = input.currentTask.deadline !== input.nextDeadline;
  const hasStatusChange = input.currentTask.status !== input.nextStatus;
  const changedLabels: string[] = [];

  if (hasAssigneeChange) changedLabels.push('người phụ trách');
  if (hasDeadlineChange) changedLabels.push('deadline');
  if (hasStatusChange) changedLabels.push('trạng thái');

  return { hasAssigneeChange, hasDeadlineChange, hasStatusChange, changedLabels };
}

export function hasTaskEditChanges(intent: TaskEditIntent | null): boolean {
  return Boolean(intent && intent.changedLabels.length > 0);
}
