import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isTaskOverdue, summarizeProjectExecution, taskDependencyLabel } from '../lib/project-execution-summary';
import { TaskAssignmentValidationError, validateTaskAssignmentAssignPayload, validateTaskAssignmentStatusPayload, validateTaskAssignmentUpdatePayload } from '../services/taskAssignmentFoundation';

const repositoryRoot = join(__dirname, '..');
const source = (relativePath: string) => readFileSync(join(repositoryRoot, relativePath), 'utf8');

describe('Corrective Slice 4 project execution workflow', () => {
  it('summarizes dashboard and phase execution metrics from stable task identifiers', () => {
    const now = new Date('2026-07-21T12:00:00Z');
    const metrics = summarizeProjectExecution([
      { taskId: 1, assigneeEmployeeId: 3, assigneeFullName: 'An', deadline: '2026-07-20', status: 'IN_PROGRESS' },
      { taskId: 2, assigneeEmployeeId: 3, assigneeFullName: 'An', deadline: '2026-07-22', status: 'COMPLETED' },
      { taskId: 3, assigneeEmployeeId: 4, assigneeFullName: 'Bình', deadline: '2026-07-25', status: 'BLOCKED' },
      { taskId: 4, assigneeEmployeeId: null, deadline: '2026-07-21T18:00:00Z', status: 'PENDING_REVIEW' },
    ], now);

    expect(metrics).toMatchObject({
      totalTasks: 4,
      completedTasks: 1,
      inProgressTasks: 1,
      blockedTasks: 1,
      overdueTasks: 1,
      completionPercent: 25,
      unassignedTasks: 1,
      needsReviewTasks: 1,
      upcomingDeadlineTasks: 3,
    });
    expect(metrics.memberWorkload[0]).toMatchObject({ employeeId: 3, taskCount: 2, overdueCount: 1 });
    expect(isTaskOverdue({ deadline: '2026-07-20', status: 'COMPLETED' }, now)).toBe(false);
    expect(taskDependencyLabel({ parentTaskId: 9 })).toBe('Phụ thuộc #9');
  });

  it('keeps completed-task edits behind explicit manager override evidence', () => {
    const service = source('services/server/taskAssignmentFoundation.ts');
    expect(validateTaskAssignmentUpdatePayload({ deadline: '2026-07-30', overrideCompleted: true, overrideReason: 'Sửa deadline theo kế hoạch mới' })).toMatchObject({ overrideCompleted: true });
    expect(validateTaskAssignmentAssignPayload({ assigneeEmployeeId: null, overrideCompleted: true, overrideReason: 'Bàn giao lại sau nghiệm thu' })).toMatchObject({ assigneeEmployeeId: null });
    expect(validateTaskAssignmentStatusPayload({ status: 'IN_PROGRESS', overrideCompleted: true, overrideReason: 'Mở lại để sửa lỗi' })).toMatchObject({ status: 'IN_PROGRESS' });
    expect(() => validateTaskAssignmentUpdatePayload({ deadline: '2026-07-30', overrideCompleted: 'yes' })).toThrow(TaskAssignmentValidationError);
    expect(service).toMatch(/task_assignment_completed_override_required/);
    expect(service).toMatch(/assertCompletedTaskOverride\(currentTask, payload\.overrideCompleted, payload\.overrideReason\)/);
    expect(service).toMatch(/previousAssigneeEmployeeId/);
    expect(service).toMatch(/TASK_ASSIGNED/);
    expect(service).toMatch(/task_notifications/);
  });

  it('renders production project detail task columns and dashboard workload without duplicated task display logic', () => {
    const projectDetail = source('app/admin/projects/[projectId]/page.tsx');
    expect(projectDetail).toMatch(/summarizeProjectExecution/);
    expect(projectDetail).toMatch(/getTaskPriorityLabel/);
    expect(projectDetail).toMatch(/getTaskDependencyLabel/);
    expect(projectDetail).toMatch(/getTaskLastUpdateLabel/);
    expect(projectDetail).toMatch(/Số công việc/);
    expect(projectDetail).toMatch(/Tải công việc thành viên/);
    expect(projectDetail).toMatch(/Bị vướng/);
    expect(projectDetail).toMatch(/Quá hạn/);
    expect(projectDetail).toMatch(/activeProjectMembers/);
  });
});
