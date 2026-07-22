import type { TaskAssignmentDTO, TaskAssignmentStatus } from '@/lib/types/task-assignment';

export interface ProjectExecutionTaskLike {
  taskId?: number | null;
  parentTaskId?: number | null;
  assigneeEmployeeId?: number | null;
  assigneeFullName?: string | null;
  deadline?: string | null;
  status?: string | null;
  priority?: string | null;
  lastActivityAt?: string | null;
}

export interface ProjectExecutionMetrics {
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  blockedTasks: number;
  overdueTasks: number;
  completionPercent: number;
  unassignedTasks: number;
  needsReviewTasks: number;
  upcomingDeadlineTasks: number;
  memberWorkload: Array<{ employeeId: number; assigneeFullName: string; taskCount: number; overdueCount: number }>;
}

export function normalizeTaskStatus(status?: string | null): TaskAssignmentStatus | 'UNKNOWN' {
  const normalized = String(status || '').trim().toUpperCase().replace(/[-\s]/g, '_');
  if (normalized === 'DONE') return 'COMPLETED';
  if (normalized === 'DOING') return 'IN_PROGRESS';
  if (normalized === 'PENDINGREVIEW' || normalized === 'REVIEW') return 'PENDING_REVIEW';
  if (normalized === 'TODO') return 'BACKLOG';
  if (
    normalized === 'BACKLOG' ||
    normalized === 'READY' ||
    normalized === 'IN_PROGRESS' ||
    normalized === 'PENDING_REVIEW' ||
    normalized === 'REVISION_REQUIRED' ||
    normalized === 'APPROVED' ||
    normalized === 'BLOCKED' ||
    normalized === 'ON_HOLD' ||
    normalized === 'COMPLETED' ||
    normalized === 'CANCELLED'
  ) return normalized;
  return 'UNKNOWN';
}

export function isTaskOverdue(task: ProjectExecutionTaskLike, now = new Date()): boolean {
  const status = normalizeTaskStatus(task.status);
  if (status === 'COMPLETED' || status === 'CANCELLED') return false;
  if (!task.deadline) return false;
  const deadline = new Date(task.deadline);
  if (Number.isNaN(deadline.getTime())) return false;
  return deadline.getTime() < now.getTime();
}

export function summarizeProjectExecution(tasks: readonly ProjectExecutionTaskLike[], now = new Date()): ProjectExecutionMetrics {
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((task) => normalizeTaskStatus(task.status) === 'COMPLETED').length;
  const inProgressTasks = tasks.filter((task) => normalizeTaskStatus(task.status) === 'IN_PROGRESS').length;
  const blockedTasks = tasks.filter((task) => normalizeTaskStatus(task.status) === 'BLOCKED').length;
  const needsReviewTasks = tasks.filter((task) => normalizeTaskStatus(task.status) === 'PENDING_REVIEW').length;
  const overdueTasks = tasks.filter((task) => isTaskOverdue(task, now)).length;
  const unassignedTasks = tasks.filter((task) => !task.assigneeEmployeeId).length;
  const sevenDaysFromNow = new Date(now);
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
  const upcomingDeadlineTasks = tasks.filter((task) => {
    if (!task.deadline || isTaskOverdue(task, now)) return false;
    const deadline = new Date(task.deadline);
    return !Number.isNaN(deadline.getTime()) && deadline.getTime() <= sevenDaysFromNow.getTime();
  }).length;
  const workloadByEmployee = new Map<number, { employeeId: number; assigneeFullName: string; taskCount: number; overdueCount: number }>();
  tasks.forEach((task) => {
    if (!task.assigneeEmployeeId) return;
    const current = workloadByEmployee.get(task.assigneeEmployeeId) || {
      employeeId: task.assigneeEmployeeId,
      assigneeFullName: task.assigneeFullName || `Nhân sự #${task.assigneeEmployeeId}`,
      taskCount: 0,
      overdueCount: 0,
    };
    current.taskCount += 1;
    if (isTaskOverdue(task, now)) current.overdueCount += 1;
    workloadByEmployee.set(task.assigneeEmployeeId, current);
  });

  return {
    totalTasks,
    completedTasks,
    inProgressTasks,
    blockedTasks,
    overdueTasks,
    completionPercent: totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100),
    unassignedTasks,
    needsReviewTasks,
    upcomingDeadlineTasks,
    memberWorkload: Array.from(workloadByEmployee.values()).sort((left, right) => right.taskCount - left.taskCount || left.assigneeFullName.localeCompare(right.assigneeFullName, 'vi-VN')),
  };
}

export function taskDependencyLabel(task: Pick<TaskAssignmentDTO, 'parentTaskId'>): string {
  return task.parentTaskId ? `Phụ thuộc #${task.parentTaskId}` : 'Không có phụ thuộc';
}
