import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repositoryRoot = join(__dirname, '..');

function source(relativePath: string): string {
  return readFileSync(join(repositoryRoot, relativePath), 'utf8');
}

describe('task load schema alignment', () => {
  it('loads the employee directory by employees.id, not employees.employee_id', () => {
    const employeeService = source('services/employeeService.ts');
    const taskPage = source('app/admin/tasks/page.tsx');

    expect(employeeService).toMatch(/select\('id, full_name, title, status'\)/);
    expect(employeeService).not.toMatch(/select\([^)]*employee_id/);
    expect(taskPage).not.toMatch(/employee\.employee_id|emp\.employee_id|e\.employee_id|matchedEmployee\?\.employee_id/);
  });

  it('keeps legacy tasks assigned_to and packer_assigned as text, not fake employee relations', () => {
    const repository = source('services/repositories/workflowRepository.ts');

    expect(repository).toMatch(/assigned_to/);
    expect(repository).toMatch(/packer_assigned/);
    expect(repository).toMatch(/select\('id, project_name, assigned_to, current_phase, estimation_date, issue_note, packer_assigned, created_at'\)/);
    expect(repository).not.toMatch(/pickFirstNumber\(row, \['assignee_id', 'employee_id'\]\)/);
    expect(repository).not.toMatch(/\{ employee_id: params\.value \}/);
  });

  it('maps legacy task assignment text without inventing an employee id', () => {
    const repository = source('services/repositories/workflowRepository.ts');

    expect(repository).toMatch(/const assignedToText = pickFirstText\(row, \['assigned_to'\]\)/);
    expect(repository).toMatch(/const packerAssignedText = pickFirstText\(row, \['packer_assigned'\]\)/);
    expect(repository).toMatch(/const currentPhaseText = pickFirstText\(row, \['current_phase'\]\)/);
    expect(repository).toMatch(/const estimationDate = pickFirstText\(row, \['estimation_date'\]\) \|\| null/);
    expect(repository).toMatch(/const issueNote = pickFirstText\(row, \['issue_note'\]\) \|\| null/);
    expect(repository).toMatch(/const createdAt = pickFirstText\(row, \['created_at'\]\) \|\| null/);
    expect(repository).toMatch(/const projectName = pickFirstText\(row, \['project_name'\]\) \|\| null/);
    expect(repository).toMatch(/const assigneeName = assignedToText \|\| packerAssignedText/);
    expect(repository).toMatch(/phase_id: null/);
    expect(repository).toMatch(/assignee_id: null/);
    expect(repository).toMatch(/projectName,/);
    expect(repository).toMatch(/estimationDate,/);
    expect(repository).toMatch(/issueNote,/);
    expect(repository).toMatch(/createdAt,/);
  });

  it('keeps orphan and partially empty task rows mappable', () => {
    const repository = source('services/repositories/workflowRepository.ts');

    expect(repository).toMatch(/if \(id === null\) return null/);
    expect(repository).toMatch(/project_name: task\.projectName \|\| ''/);
    expect(repository).toMatch(/const currentPhaseText = pickFirstText\(row, \['current_phase'\]\)/);
    expect(repository).toMatch(/status: currentPhaseText \|\| 'TODO'/);
    expect(repository).toMatch(/name: projectName \|\| `Task \$\{id\}`/);
  });

  it('does not read legacy tasks through a fake phase relation', () => {
    const repository = source('services/repositories/workflowRepository.ts');
    const workflowService = source('services/workflowService.ts');

    expect(repository).toMatch(/async listTasksByPhaseIds\(phaseIds: number\[\]\): Promise<WorkflowTask\[\]> \{\s*void phaseIds;\s*return \[\];\s*\}/);
    expect(repository).not.toMatch(/\.from\('tasks'\)[\s\S]{0,400}\.in\('phase_id'/);
    expect(workflowService).not.toMatch(/listTasksByPhaseIds/);
    expect(workflowService).not.toMatch(/tasksByPhaseId/);
  });

  it('does not turn task load failures into an empty list or expose raw database text', () => {
    const taskPage = source('app/admin/tasks/page.tsx');
    const workflowService = source('services/workflowService.ts');

    expect(taskPage).toMatch(/Không thể tải dữ liệu công việc\./);
    expect(taskPage).not.toMatch(/showToast\('Lỗi tải dữ liệu', e\.message/);
    expect(workflowService).not.toMatch(/catch\s*\([^)]*\)\s*\{\s*return\s*\[\]/);
  });

  it('keeps staff_tasks employee relations on employee_id while employees use id', () => {
    const repository = source('services/repositories/workflowRepository.ts');

    expect(repository).not.toMatch(/employees!inner/);
    expect(repository).not.toMatch(/employees\.employee_id/);
  });
});
