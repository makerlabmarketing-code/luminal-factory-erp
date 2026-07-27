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

    expect(notification).toMatch(/fixed left-3 right-3 top-24/);
    const overlays = source('lib/constants/overlays.ts');

    expect(notification).toMatch(/OVERLAY_Z_INDEX\.notification/);
    expect(notification).toMatch(/OVERLAY_Z_INDEX\.confirmation/);
    const notificationZIndex = Number(overlays.match(/notification: (\d+)/)?.[1]);
    const confirmationZIndex = Number(overlays.match(/confirmation: (\d+)/)?.[1]);

    expect(notificationZIndex).toBe(999999);
    expect(confirmationZIndex).toBe(999998);
    expect(notificationZIndex).toBeGreaterThan(confirmationZIndex);
    expect(notification).toMatch(/durationMs/);
    expect(notification).toMatch(/actionLabel/);
    expect(notification).not.toMatch(/fixed inset-0 bg-black\/70[\s\S]{0,220}toast\.show/);
  });

  it('shows a blocking creation overlay and prevents closing or duplicate submit while creating', () => {
    const projectPage = source('app/admin/projects/page.tsx');

    for (const page of [projectPage]) {
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
    const detailPage = source('app/admin/projects/[projectId]/page.tsx');
    const service = source('services/workflowService.ts');
    const repository = source('services/repositories/workflowRepository.ts');

    expect(repository).toMatch(/select\('id, project_name, drive_url, status, created_at'\)/);
    expect(service).toMatch(/project_created_at/);
    expect(service).toMatch(/phase_created_at/);
    expect(service).toMatch(/phase_order_index/);
    expect(detailPage).toMatch(/Stepper giai đoạn/);
    expect(detailPage).toMatch(/notFound\(\)/);
  });


  it('keeps project detail progress and modals accessible without changing mutation contracts', () => {
    const detailPage = source('app/admin/projects/[projectId]/page.tsx');

    expect(detailPage).toMatch(/role="progressbar"/);
    expect(detailPage).toMatch(/aria-valuenow=\{projectDetail\.progressPercent\}/);
    expect(detailPage).toMatch(/aria-labelledby="add-member-title"/);
    expect(detailPage).toMatch(/aria-describedby="add-member-description"/);
    expect(detailPage).toMatch(/htmlFor="project-member-employee"/);
    expect(detailPage).toMatch(/id="project-member-employee"/);
    expect(detailPage).toMatch(/aria-labelledby="edit-task-title"/);
    expect(detailPage).toMatch(/aria-describedby="edit-task-description"/);
    expect(detailPage).toMatch(/htmlFor="edit-task-assignee"/);
    expect(detailPage).toMatch(/id="edit-task-assignee"/);
    expect(detailPage).toMatch(/htmlFor="edit-task-comment"/);
    expect(detailPage).toMatch(/htmlFor="project-drive-link"/);
    expect(detailPage).toMatch(/id="project-drive-link"/);
    expect(detailPage).toMatch(/<button type="button" disabled=\{!canManageProject\} onClick=\{handleSaveDriveLink\}/);
    expect(detailPage).not.toMatch(/>Deadline</);
    expect(detailPage).toMatch(/aria-labelledby="edit-phase-title"/);
    expect(detailPage).toMatch(/htmlFor="edit-phase-name"/);
    expect(detailPage).toMatch(/id="edit-phase-name"/);
    expect(detailPage).toMatch(/htmlFor="edit-phase-order"/);
    expect(detailPage).toMatch(/id="edit-phase-order"/);
    expect(detailPage).not.toMatch(/aria-label="Thêm thành viên dự án"/);
    expect(detailPage).not.toMatch(/aria-label="Sửa công việc con"/);
  });


  it('keeps project detail operational guidance in Vietnamese copy', () => {
    const detailPage = source('app/admin/projects/[projectId]/page.tsx');

    expect(detailPage).toMatch(/Nền tảng giao việc chưa sẵn sàng/);
    expect(detailPage).toMatch(/Dữ liệu công việc cũ/);
    expect(detailPage).toMatch(/Thêm thành viên đang hoạt động/);
    expect(detailPage).toMatch(/nền tảng giao việc trả về dữ liệu theo giai đoạn/);
    expect(detailPage).toMatch(/Công việc cũ không có giai đoạn hiện tại/);
    expect(detailPage).toMatch(/>Giai đoạn: \{/);
    expect(detailPage).toMatch(/Quy trình tuần tự hiện chỉ cho xem/);
    expect(detailPage).toMatch(/cổng dữ liệu trạng thái và phụ thuộc/);
    expect(detailPage).toMatch(/hộp thoại/);
    expect(detailPage).toMatch(/Người phụ trách phải là thành viên đang hoạt động/);
    expect(detailPage).not.toMatch(/Task Assignment Foundation|Task legacy|Sequential workflow|membership ACTIVE|thành viên ACTIVE|cổng migration|read-only|derive read-only|hard delete membership|Server chưa có mutation|state machine/);
  });

  it('redirects the legacy task list to the canonical project workspace', () => {
    const taskPage = source('app/admin/tasks/page.tsx');
    expect(taskPage).toMatch(/redirect\(`\/admin\/projects/);
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
    const projectPage = source('app/admin/projects/page.tsx');
    const detailPage = source('app/admin/projects/[projectId]/page.tsx');
    const service = source('services/server/projectMutations.ts');

    expect(repository).toMatch(/\/api\/admin\/projects\/\$\{projectId\}\/archive/);
    expect(repository).not.toMatch(/from\('projects'\)\.delete/);
    expect(service).toMatch(/CANCELLED/);
    expect(projectPage).toMatch(/Huỷ dự án/);
    expect(detailPage).toMatch(/Hủy dự án|Huỷ dự án/);
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
    const projectPage = source('app/admin/projects/page.tsx');

    for (const page of [projectPage]) {
      expect(page).not.toMatch(/PGRST|42703|schema cache|column .* does not exist/);
      expect(page).toMatch(/Không thể tạo dự án\./);
    }
  });
});
