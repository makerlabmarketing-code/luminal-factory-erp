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
    expect(service).toMatch(/project:\s*\{[\s\S]*?id: number;[\s\S]*?projectCode: string;[\s\S]*?name: string;/);
    expect(service).toMatch(/projectCreated: true/);
    expect(service).toMatch(/expectedPhases/);
    expect(service).toMatch(/expectedTasks/);
    expect(service).toMatch(/phasesCreated/);
    expect(service).toMatch(/tasksCreated/);
    expect(service).toMatch(/warnings: WorkflowWarning\[\]/);
  });

  it('submits workflow children only through the server create boundary', () => {
    const service = source('services/workflowService.ts');
    const createBody = service.slice(service.indexOf('export async function createWorkflowProject'), service.indexOf('export async function updateWorkflowPhaseStatus'));
    expect(createBody).toMatch(/workflowRepository\.insertProject/);
    expect(createBody).toMatch(/phases: params\.phases/);
    expect(createBody).not.toMatch(/insertTasks|insertPhase/);
  });

  it('keeps expected child counts in the normalized response contract', () => {
    const service = source('services/workflowService.ts');
    expect(service).toMatch(/const expectedTasks = params\.createTemplateTasks/);
    expect(service).toMatch(/expectedPhases/);
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

  it('uses product language rather than technical rollout language', () => {
    const projectPage = source('app/admin/projects/page.tsx');
    for (const page of [projectPage]) {
      expect(page).not.toMatch(/Cần duyệt RPC giao dịch/);
      expect(page).toMatch(/Không thể khởi tạo đầy đủ quy trình/);
    }
  });

  it('keeps project failure messages distinct from phase and task child failures', () => {
    const projectPage = source('app/admin/projects/page.tsx');

    for (const page of [projectPage]) {
      expect(page).toMatch(/Không thể tạo dự án\./);
      expect(page).toMatch(/Không thể lưu giai đoạn\./);
    }
  });
});
