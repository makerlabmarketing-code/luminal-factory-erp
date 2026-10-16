import type { TaskAssignmentStatus } from '@/lib/types/task-assignment';

export const STAFF_TASK_LABELS: Record<TaskAssignmentStatus, string> = {
  BACKLOG: 'Chưa xếp lịch', READY: 'Sẵn sàng', IN_PROGRESS: 'Đang làm',
  PENDING_REVIEW: 'Chờ duyệt', REVISION_REQUIRED: 'Cần sửa', APPROVED: 'Đã duyệt',
  BLOCKED: 'Bị vướng', ON_HOLD: 'Tạm dừng', COMPLETED: 'Hoàn thành', CANCELLED: 'Đã hủy',
};

export function staffTaskStatus(value?: string | null): TaskAssignmentStatus {
  if (value === 'DONE') return 'COMPLETED';
  if (value === 'DOING') return 'IN_PROGRESS';
  if (value === 'TODO') return 'READY';
  return value && Object.hasOwn(STAFF_TASK_LABELS, value) ? value as TaskAssignmentStatus : 'BACKLOG';
}

export function staffTaskActions(status: TaskAssignmentStatus): Array<{ status: TaskAssignmentStatus; label: string }> {
  switch (status) {
    case 'BACKLOG': return [{ status: 'READY', label: 'Sẵn sàng làm' }];
    case 'READY': return [{ status: 'IN_PROGRESS', label: 'Bắt đầu' }];
    case 'REVISION_REQUIRED': return [{ status: 'IN_PROGRESS', label: 'Bắt đầu sửa' }];
    case 'IN_PROGRESS': return [{ status: 'PENDING_REVIEW', label: 'Xong — gửi duyệt' }, { status: 'BLOCKED', label: 'Báo vướng' }];
    case 'BLOCKED': return [{ status: 'IN_PROGRESS', label: 'Tiếp tục làm' }];
    case 'ON_HOLD': return [{ status: 'READY', label: 'Sẵn sàng làm' }];
    case 'APPROVED': return [{ status: 'COMPLETED', label: 'Hoàn thành' }];
    default: return [];
  }
}
