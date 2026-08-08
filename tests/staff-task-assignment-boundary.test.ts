import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const routeSource = readFileSync('app/api/staff/tasks/route.ts', 'utf8');
const clientSource = readFileSync('services/staffTasksService.ts', 'utf8');

describe('Staff task assignment boundary', () => {
  it('resolves Staff identity on the server and filters tasks by stable employee ID', () => {
    expect(routeSource).toContain("requireWorkspaceAccess('STAFF_WORKSPACE')");
    expect(routeSource).toContain(".eq('assignee_employee_id', employeeId)");
    expect(routeSource).toContain(".eq('employee_id', employeeId)");
    expect(routeSource).toContain(".eq('status', 'ACTIVE')");
  });

  it('does not expose global workflow loading to the Staff client', () => {
    expect(clientSource).toContain("fetch('/api/staff/tasks'");
    expect(clientSource).not.toContain('getWorkflowItems');
    expect(clientSource).not.toContain('updateWorkflowTask');
    expect(clientSource).not.toContain('updateWorkflowProjectDriveLink');
  });

  it('uses stable task IDs for Staff mutations and rechecks assignment server-side', () => {
    expect(clientSource).toContain('taskId: task.id');
    expect(routeSource).toContain(".eq('id', taskId)");
    expect(routeSource).toContain(".eq('assignee_employee_id', employeeId)");
    expect(routeSource).toContain(".from('task_comments').insert");
  });

  it('rejects project-level Drive mutation from the Staff surface', () => {
    expect(clientSource).toContain('Nhân viên chỉ được cập nhật công việc được giao.');
    expect(clientSource).not.toContain("method: 'PATCH',\n    headers: { 'Content-Type': 'application/json' },\n    body: JSON.stringify({ project");
  });

  it('keeps the response projection limited to projects that contain assigned tasks', () => {
    expect(routeSource).toContain('const scopedTasks = taskRows.filter');
    expect(routeSource).toContain('allowedProjectIds.has(Number(task.project_id))');
    expect(routeSource).toContain("group_name: 'STAFF_ASSIGNED_TASKS'");
    expect(routeSource).not.toContain('assigned_to');
  });
});
