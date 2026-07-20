import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repositoryRoot = join(__dirname, '..');

function source(relativePath: string): string {
  return readFileSync(join(repositoryRoot, relativePath), 'utf8');
}

describe('task detail subtask binding', () => {
  it('renders legacy assignee text without employee lookup or raw ids', () => {
    const detailPage = source('app/admin/projects/[projectId]/page.tsx');
    const repository = source('services/repositories/workflowRepository.ts');

    expect(repository).toMatch(/assigned_to/);
    expect(detailPage).toMatch(/function getTaskAssigneeLabel\(task: DisplayTask\): string/);
    expect(detailPage).toMatch(/task\.assignedEmployee\?\.fullName \|\| task\.assignedToText \|\| 'Chưa phân công'/);
    expect(detailPage).toMatch(/Người phụ trách: \{getTaskAssigneeLabel\(task\)\}/);
    expect(detailPage).not.toMatch(/employees\.map|getActiveEmployees|findEmployeeByName/);
  });

  it('renders deadline from estimationDate and never shows Invalid Date', () => {
    const detailPage = source('app/admin/projects/[projectId]/page.tsx');
    const repository = source('services/repositories/workflowRepository.ts');

    expect(repository).toMatch(/const estimationDate = pickFirstText\(row, \['estimation_date'\]\) \|\| null/);
    expect(detailPage).toMatch(/function getTaskDeadlineLabel\(task: DisplayTask\): string/);
    expect(detailPage).toMatch(/formatDate\(task\.estimationDate \|\| task\.deadline\)/);
    expect(detailPage).toMatch(/if \(Number\.isNaN\(date\.getTime\(\)\)\) return 'Chưa đặt deadline'/);
    expect(detailPage).not.toMatch(/Invalid Date/);
  });

  it('keeps legacy task detail read-only and avoids N plus one employee queries', () => {
    const detailPage = source('app/admin/projects/[projectId]/page.tsx');
    const repository = source('services/repositories/workflowRepository.ts');

    expect(detailPage).toMatch(/selectedPhase\.tasks\.map/);
    expect(repository).toMatch(/select\('id, project_name, assigned_to, current_phase, estimation_date, issue_note, packer_assigned, created_at'\)/);
    expect(repository).not.toMatch(/\.from\('employees'\)/);
    expect(detailPage).toMatch(/activeProjectMembers/);
    expect(detailPage).not.toMatch(/updateWorkflowTask|updateWorkflowTaskField/);
  });
});
