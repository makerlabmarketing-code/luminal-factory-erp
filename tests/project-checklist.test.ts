import { describe, expect, it } from 'vitest';
import { buildChecklistPhases, projectTemplateStructure, removeChecklistTask, serializeProjectChecklist } from '../lib/project-checklist';
import { staffTaskActions } from '../lib/staff-task-actions';

describe('project checklist inheritance and safe templates', () => {
  it('inherits stage people and dates, while preserving explicit task exceptions', () => {
    const stages = buildChecklistPhases({ managerEmployeeId: '1', colorwayName: 'Chung', employees: [{ employeeId: 1, fullName: 'Manager' }, { employeeId: 2, fullName: 'Maker' }], defaultDeadline: () => '2026-10-30', stages: [{ name: 'Sculpt', type: '3D', weight: 1, employeeId: '2', deadline: '2026-10-24', taskNames: ['Khối', 'Chi tiết'], taskOverrides: { 1: { employeeId: '1', deadline: '2026-10-25' } } }] });
    expect(stages[0].tasks?.map((task) => [task.assignee_id, task.deadline])).toEqual([[2, '2026-10-24'], [1, '2026-10-25']]);
    expect(stages[0].stage_owner).toBe('Maker');
  });
  it('removes only the deleted task override, keeping subsequent assignments attached', () => {
    const next = removeChecklistTask({ name: 'Test', type: 'TEST', weight: 1, taskNames: ['A', 'B', 'C'], taskOverrides: { 0: { employeeId: '1' }, 2: { employeeId: '3' } } }, 0);
    expect(next.taskNames).toEqual(['B', 'C']);
    expect(next.taskOverrides).toEqual({ 1: { employeeId: '3' } });
  });
  it('copies only structure into templates, with role-based reassignment on the new project', () => {
    const template = projectTemplateStructure([{ id: 8, name: 'Duyệt', required_review: true }], [{ phase_id: 8, title: 'Master', is_required: true, requires_review: true }]);
    expect(template[0].tasks[0]).toMatchObject({ name: 'Master', assigneeRoleCode: 'PROJECT_MANAGER', startOffsetDays: null });
    expect(JSON.stringify(template)).not.toMatch(/employeeId|deadline|status|note|completedAt/);
  });
  it('links serialized tasks to their phase and deduplicates inherited members', () => {
    const phases = buildChecklistPhases({ managerEmployeeId: '1', colorwayName: 'Chung', employees: [], defaultDeadline: () => '2026-10-30', stages: [{ name: 'Sculpt', type: '3D', weight: 1, taskNames: ['A', 'B'] }] });
    const payload = serializeProjectChecklist(phases);
    expect(payload.tasks.map(task => [task.phaseClientId, task.status, task.assigneeEmployeeId])).toEqual([['stage-0', 'BACKLOG', 1], ['stage-0', 'BACKLOG', 1]]);
    expect(payload.phases[0].clientId).toBe('stage-0');
    expect(payload.memberEmployeeIds).toEqual([1]);
  });
  it('makes submission distinct from approval and never offers staff approval actions', () => {
    expect(staffTaskActions('IN_PROGRESS').map((action) => action.status)).toEqual(['PENDING_REVIEW', 'BLOCKED']);
    expect(staffTaskActions('PENDING_REVIEW')).toEqual([]);
    expect(staffTaskActions('COMPLETED')).toEqual([]);
    expect(staffTaskActions('APPROVED')[0].status).toBe('COMPLETED');
  });
});
