import type { TaskAssignmentStatus } from '@/lib/types/task-assignment';

export const TASK_BOARD_COLUMNS: ReadonlyArray<{ id: string; title: string; statuses: readonly TaskAssignmentStatus[] }> = [
  { id: 'todo', title: 'Chưa bắt đầu', statuses: ['BACKLOG', 'READY'] },
  { id: 'doing', title: 'Đang làm', statuses: ['IN_PROGRESS'] },
  { id: 'review', title: 'Chờ duyệt', statuses: ['PENDING_REVIEW'] },
  { id: 'revision', title: 'Cần sửa', statuses: ['REVISION_REQUIRED'] },
  { id: 'approved', title: 'Đã duyệt', statuses: ['APPROVED'] },
  { id: 'blocked', title: 'Bị vướng', statuses: ['BLOCKED', 'ON_HOLD'] },
  { id: 'done', title: 'Hoàn thành', statuses: ['COMPLETED'] },
  { id: 'cancelled', title: 'Đã hủy', statuses: ['CANCELLED'] },
];

export function dropStatus(
  current: TaskAssignmentStatus,
  destinations: readonly TaskAssignmentStatus[],
  allowed: readonly TaskAssignmentStatus[],
) {
  if (destinations.includes(current)) return undefined;
  return destinations.find(status => allowed.includes(status));
}
