import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repositoryRoot = join(__dirname, '..');

function source(relativePath: string): string {
  return readFileSync(join(repositoryRoot, relativePath), 'utf8');
}

describe('project creation orchestration and legacy task alignment', () => {
  it('returns a structured partial-success result after project creation', () => {
    const service = source('services/workflowService.ts');

    expect(service).toMatch(/export interface WorkflowProjectCreateResult/);
    expect(service).toMatch(/projectCreated: true/);
    expect(service).toMatch(/phasesCreated/);
    expect(service).toMatch(/tasksCreated: 0/);
    expect(service).toMatch(/warnings: Array\.from\(new Set\(warnings\)\)/);
  });

  it('does not create template tasks against the legacy tasks table during project create', () => {
    const service = source('services/workflowService.ts');
    const createWorkflowProjectBody = service.slice(
      service.indexOf('export async function createWorkflowProject'),
      service.indexOf('export async function updateWorkflowPhaseStatus')
    );

    expect(createWorkflowProjectBody).not.toMatch(/insertTasks/);
    expect(createWorkflowProjectBody).not.toMatch(/assignee_id: task\.assignee_id/);
    expect(createWorkflowProjectBody).toMatch(/warnings\.push\('Không thể tạo công việc\.'\)/);
  });

  it('keeps legacy task insert payload limited to live task columns', () => {
    const repository = source('services/repositories/workflowRepository.ts');
    const insertTasksBody = repository.slice(
      repository.indexOf('async insertTasks'),
      repository.indexOf('async updatePhaseStatus')
    );

    expect(insertTasksBody).toMatch(/project_name/);
    expect(insertTasksBody).toMatch(/assigned_to/);
    expect(insertTasksBody).toMatch(/current_phase/);
    expect(insertTasksBody).toMatch(/estimation_date/);
    expect(insertTasksBody).toMatch(/issue_note/);
    expect(insertTasksBody).toMatch(/packer_assigned/);
    expect(insertTasksBody).not.toMatch(/assignee_id|phase_id|task_status|reviewer_id|assigned_employee_id/);
  });

  it('shows partial-success warnings instead of project-create failure after child warnings', () => {
    const taskPage = source('app/admin/tasks/page.tsx');
    const projectPage = source('app/admin/projects/page.tsx');

    for (const page of [taskPage, projectPage]) {
      expect(page).toMatch(/Dự án đã được tạo nhưng chưa thể khởi tạo đầy đủ giai đoạn\/công việc mẫu\./);
      expect(page).toMatch(/setShowAddModal\(false\)/);
      expect(page).toMatch(/await loadData\(\)/);
    }
  });

  it('keeps project failure messages distinct from phase and task child failures', () => {
    const taskPage = source('app/admin/tasks/page.tsx');
    const projectPage = source('app/admin/projects/page.tsx');

    for (const page of [taskPage, projectPage]) {
      expect(page).toMatch(/Không thể tạo dự án\./);
      expect(page).toMatch(/Không thể lưu giai đoạn\./);
    }
  });
});
