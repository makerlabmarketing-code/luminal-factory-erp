import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repositoryRoot = join(__dirname, '..');

function source(relativePath: string): string {
  return readFileSync(join(repositoryRoot, relativePath), 'utf8');
}

describe('project creation orchestration and legacy task alignment', () => {
  it('keeps a structured project create result contract for simple project creation', () => {
    const service = source('services/workflowService.ts');

    expect(service).toMatch(/export interface WorkflowProjectCreateResult/);
    expect(service).toMatch(/project:\s*\{\s*id: number;\s*name: string;\s*\}/);
    expect(service).toMatch(/projectCreated: true/);
    expect(service).toMatch(/expectedPhases/);
    expect(service).toMatch(/expectedTasks/);
    expect(service).toMatch(/phasesCreated/);
    expect(service).toMatch(/tasksCreated/);
    expect(service).toMatch(/warnings: WorkflowWarning\[\]/);
  });

  it('does not create template tasks or partial projects without the atomic RPC gate', () => {
    const service = source('services/workflowService.ts');
    const createWorkflowProjectBody = service.slice(
      service.indexOf('export async function createWorkflowProject'),
      service.indexOf('export async function updateWorkflowPhaseStatus')
    );

    expect(createWorkflowProjectBody).not.toMatch(/insertTasks/);
    expect(createWorkflowProjectBody).not.toMatch(/assignee_id: task\.assignee_id/);
    expect(createWorkflowProjectBody).toMatch(/WorkflowProjectCreationGateError/);
    expect(createWorkflowProjectBody).toMatch(/params\.phases\.length > 0 \|\| expectedTasks > 0/);
    expect(createWorkflowProjectBody.indexOf('throw new WorkflowProjectCreationGateError()')).toBeLessThan(createWorkflowProjectBody.indexOf('workflowRepository.insertProject'));
  });

  it('keeps expected task counting explicit for the approved future RPC contract', () => {
    const service = source('services/workflowService.ts');
    const createWorkflowProjectBody = service.slice(
      service.indexOf('export async function createWorkflowProject'),
      service.indexOf('export async function updateWorkflowPhaseStatus')
    );

    expect(createWorkflowProjectBody).toMatch(/const expectedTasks = params\.createTemplateTasks/);
    expect(createWorkflowProjectBody).toMatch(/expectedTasks > 0/);
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

  it('shows the atomic RPC gate instead of partial-success warnings for child persistence', () => {
    const taskPage = source('app/admin/tasks/page.tsx');
    const projectPage = source('app/admin/projects/page.tsx');

    for (const page of [taskPage, projectPage]) {
      expect(page).toMatch(/project_creation_atomic_rpc_required/);
      expect(page).toMatch(/Cần duyệt RPC giao dịch trước khi tạo dự án kèm giai đoạn và công việc/);
      expect(page).not.toMatch(/Một số công việc mẫu chưa thể khởi tạo\./);
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
