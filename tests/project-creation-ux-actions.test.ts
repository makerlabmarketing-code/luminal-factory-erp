import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repositoryRoot = join(__dirname, '..');

function source(relativePath: string): string {
  return readFileSync(join(repositoryRoot, relativePath), 'utf8');
}

describe('project creation UX, detail actions, and request cleanup', () => {
  it('uses a top-right toast instead of a blocking toast modal', () => {
    const notification = source('component/NotificationContext.tsx');

    expect(notification).toMatch(/fixed right-3 top-3/);
    const overlays = source('lib/constants/overlays.ts');

    expect(notification).toMatch(/OVERLAY_Z_INDEX\.notification/);
    expect(notification).toMatch(/OVERLAY_Z_INDEX\.confirmation/);
    expect(overlays).toMatch(/notification: 999999/);
    expect(overlays).toMatch(/confirmation: 999999/);
    expect(notification).toMatch(/durationMs/);
    expect(notification).toMatch(/actionLabel/);
    expect(notification).not.toMatch(/fixed inset-0 bg-black\/70[\s\S]{0,220}toast\.show/);
  });

  it('shows a blocking creation overlay and prevents closing or duplicate submit while creating', () => {
    const taskPage = source('app/admin/tasks/page.tsx');
    const projectPage = source('app/admin/projects/page.tsx');

    for (const page of [taskPage, projectPage]) {
      expect(page).toMatch(/aria-busy="true"/);
      expect(page).toMatch(/Đang khởi tạo dự án/);
      expect(page).toMatch(/if \(isCreatingProject\) return/);
      expect(page).toMatch(/disabled=\{isCreatingProject\}/);
    }
  });

  it('does not eagerly fetch employees from project creation or detail screens', () => {
    const taskPage = source('app/admin/tasks/page.tsx');
    const projectPage = source('app/admin/projects/page.tsx');

    expect(taskPage).not.toMatch(/getActiveEmployees|findEmployeeByIdentifier|findEmployeeByName|employees\.map/);
    expect(projectPage).not.toMatch(/getActiveEmployees|employees\.map/);
  });

  it('renders project detail from live project and phase fields only', () => {
    const taskPage = source('app/admin/tasks/page.tsx');
    const detailPage = source('app/admin/projects/[projectId]/page.tsx');
    const service = source('services/workflowService.ts');
    const repository = source('services/repositories/workflowRepository.ts');

    expect(repository).toMatch(/select\('id, project_name, drive_url, status, created_at'\)/);
    expect(service).toMatch(/project_created_at/);
    expect(service).toMatch(/phase_created_at/);
    expect(service).toMatch(/phase_order_index/);
    expect(taskPage).toMatch(/Trạng thái: Chưa hỗ trợ lưu/);
    expect(detailPage).toMatch(/Stepper giai đoạn/);
    expect(detailPage).toMatch(/notFound\(\)/);
    expect(taskPage).not.toMatch(/handleUpdatePhaseStatus/);
  });

  it('links project names from the task list to the detail page', () => {
    const taskPage = source('app/admin/tasks/page.tsx');

    expect(taskPage).toMatch(/href=\{`\/admin\/projects\/\$\{projectPhases\[0\]\.project_id\}`\}/);
  });

  it('updates phase name and order through the server PATCH route without status payloads', () => {
    const route = source('app/api/admin/projects/[projectId]/phases/[phaseId]/route.ts');
    const phaseMutations = source('services/server/phaseMutations.ts');
    const repository = source('services/repositories/workflowRepository.ts');

    expect(route).toMatch(/export async function PATCH/);
    expect(route).toMatch(/updatePhase\(params\.projectId, params\.phaseId, body\)/);
    expect(phaseMutations).toMatch(/const UPDATE_PHASE_KEYS = new Set\(\['phaseName', 'orderIndex'\]\)/);
    expect(repository).toMatch(/method: 'PATCH'/);
    expect(repository).not.toMatch(/phaseStatus|status: params\.status/);
  });

  it('cancels projects through the server route and does not hard delete', () => {
    const repository = source('services/repositories/workflowRepository.ts');
    const taskPage = source('app/admin/tasks/page.tsx');
    const projectPage = source('app/admin/projects/page.tsx');
    const detailPage = source('app/admin/projects/[projectId]/page.tsx');
    const service = source('services/server/projectMutations.ts');

    expect(repository).toMatch(/\/api\/admin\/projects\/\$\{projectId\}\/archive/);
    expect(repository).not.toMatch(/from\('projects'\)\.delete/);
    expect(service).toMatch(/CANCELLED/);
    expect(taskPage).toMatch(/Hủy dự án/);
    expect(projectPage).toMatch(/Hủy dự án/);
    expect(detailPage).toMatch(/Hủy dự án/);
  });

  it('restores legacy assignee and task detail display on project detail', () => {
    const detailPage = source('app/admin/projects/[projectId]/page.tsx');

    expect(detailPage).toMatch(/assignedToText/);
    expect(detailPage).toMatch(/packerAssignedText/);
    expect(detailPage).toMatch(/currentPhaseText/);
    expect(detailPage).toMatch(/issueNote/);
    expect(detailPage).toMatch(/Công việc chưa phân giai đoạn/);
  });

  it('keeps later slice schema as a proposal draft only', () => {
    const draft = source('supabase/drafts/20260716_project_detail_phase_workflow_template_proposal.sql');

    expect(draft).toMatch(/Proposal draft only/);
    expect(draft).toMatch(/phase_templates/);
    expect(draft).toMatch(/task_comments/);
    expect(draft).toMatch(/project_activity/);
    expect(draft).not.toMatch(/^alter table/m);
    expect(draft).not.toMatch(/^create table/m);
  });

  it('keeps raw database errors out of the project creation UX', () => {
    const taskPage = source('app/admin/tasks/page.tsx');
    const projectPage = source('app/admin/projects/page.tsx');

    for (const page of [taskPage, projectPage]) {
      expect(page).not.toMatch(/PGRST|42703|schema cache|column .* does not exist/);
      expect(page).toMatch(/Không thể tạo dự án\./);
    }
  });
});
