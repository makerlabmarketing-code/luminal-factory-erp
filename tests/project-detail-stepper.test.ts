import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repositoryRoot = join(__dirname, '..');

function source(relativePath: string): string {
  return readFileSync(join(repositoryRoot, relativePath), 'utf8');
}

describe('project detail stepper and task assignee display', () => {
  it('renders a horizontal stepper from all phases', () => {
    const detailPage = source('app/admin/projects/[projectId]/page.tsx');

    expect(detailPage).toMatch(/Stepper giai đoạn/);
    expect(detailPage).toMatch(/projectDetail\.phases\.map\(\(phase, index\)/);
    expect(detailPage).toMatch(/overflow-x-auto/);
    expect(detailPage).toMatch(/scroll-snap-type:x_mandatory/);
  });

  it('shows completed, active, blocked, cancelled, and locked visual states', () => {
    const detailPage = source('app/admin/projects/[projectId]/page.tsx');

    expect(detailPage).toMatch(/phase\.status === 'COMPLETED'/);
    expect(detailPage).toMatch(/<CheckCircle2 className="h-5 w-5" \/>/);
    expect(detailPage).toMatch(/phase\.status === 'ACTIVE'/);
    expect(detailPage).toMatch(/ring-4 ring-cyan-400\/20/);
    expect(detailPage).toMatch(/phase\.status === 'BLOCKED'/);
    expect(detailPage).toMatch(/phase\.status === 'CANCELLED'/);
    expect(detailPage).toMatch(/phase\.status === 'LOCKED'/);
    expect(detailPage).toMatch(/<Lock className="h-4 w-4" \/>/);
  });

  it('keeps completed and active phases selectable while locked phases remain readonly', () => {
    const detailPage = source('app/admin/projects/[projectId]/page.tsx');

    expect(detailPage).toMatch(/setSelectedPhaseId\(phase\.item\.phase_id \|\| null\)/);
    expect(detailPage).toMatch(/function isPhaseReadonly\(phase: PhaseRecord, canManageProject = false\)/);
    expect(detailPage).toMatch(/phase\.status === 'LOCKED'/);
    expect(detailPage).toMatch(/Hoàn thành giai đoạn trước để mở khóa\./);
    expect(detailPage).toMatch(/Chỉ xem/);
  });

  it('shows manual unlock only as a manager capability placeholder, not staff mutation', () => {
    const detailPage = source('app/admin/projects/[projectId]/page.tsx');

    expect(detailPage).toMatch(/function canShowManualUnlockAction\(canManageProject: boolean, phase: PhaseRecord\)/);
    expect(detailPage).toMatch(/canManageProject && phase\.status === 'LOCKED'/);
    expect(detailPage).toMatch(/Mở khóa giai đoạn/);
    expect(detailPage).toMatch(/Server chưa có mutation mở khóa phase\./);
  });

  it('renders only the selected phase detail panel instead of all vertical cards', () => {
    const detailPage = source('app/admin/projects/[projectId]/page.tsx');

    expect(detailPage).toMatch(/\{selectedPhase && \(/);
    expect(detailPage).toMatch(/selectedPhase\.phaseName/);
    expect(detailPage).not.toMatch(/Timeline giai đoạn/);
  });

  it('renders task assignee and packer text through explicit helper fallbacks', () => {
    const detailPage = source('app/admin/projects/[projectId]/page.tsx');

    expect(detailPage).toMatch(/function getTaskAssigneeLabel\(task: WorkflowTask\): string/);
    expect(detailPage).toMatch(/task\.assignedEmployee\?\.fullName \|\| task\.assignedToText \|\| 'Chưa gán'/);
    expect(detailPage).toMatch(/function getTaskPackerLabel\(task: WorkflowTask\): string \| null/);
    expect(detailPage).toMatch(/task\.packerEmployee\?\.fullName \|\| task\.packerAssignedText \|\| null/);
    expect(detailPage).toMatch(/Người thực hiện: \{getTaskAssigneeLabel\(task\)\}/);
    expect(detailPage).toMatch(/Người đóng gói: \{getTaskPackerLabel\(task\) \|\| 'Chưa gán'\}/);
  });

  it('maps legacy tasks to matching phase text and keeps unmatched tasks in fallback group', () => {
    const detailPage = source('app/admin/projects/[projectId]/page.tsx');

    expect(detailPage).toMatch(/function mapLegacyTasksToPhaseGroups/);
    expect(detailPage).toMatch(/normalizePhaseKey\(task\.currentPhaseText \|\| task\.status\)/);
    expect(detailPage).toMatch(/const groupKey: PhaseTaskGroupKey = phaseId \|\| 'unassigned'/);
    expect(detailPage).toMatch(/Công việc chưa phân giai đoạn/);
  });

  it('shows project progress from completed phases and current active phase', () => {
    const detailPage = source('app/admin/projects/[projectId]/page.tsx');

    expect(detailPage).toMatch(/const completedPhaseCount = phases\.filter\(\(phase\) => phase\.status === 'COMPLETED'\)\.length/);
    expect(detailPage).toMatch(/const progressPercent = phases\.length > 0 \? Math\.round\(\(completedPhaseCount \/ phases\.length\) \* 100\) : 0/);
    expect(detailPage).toMatch(/Tiến độ dự án/);
    expect(detailPage).toMatch(/currentPhaseId: activePhase\?\.item\.phase_id \|\| null/);
  });

  it('does not expose raw database errors and does not fetch employees only to render legacy text', () => {
    const detailPage = source('app/admin/projects/[projectId]/page.tsx');
    const repository = source('services/repositories/workflowRepository.ts');

    expect(detailPage).toMatch(/Không thể tải chi tiết dự án\./);
    expect(detailPage).not.toMatch(/PGRST|42703|schema cache|column .* does not exist/);
    expect(detailPage).not.toMatch(/getActiveEmployees|findEmployeeByIdentifier|findEmployeeByName|employees\.map/);
    expect(repository).toMatch(/select\('id, project_name, assigned_to, current_phase, estimation_date, issue_note, packer_assigned, created_at'\)/);
  });

  it('keeps project create/detail route contracts in place', () => {
    const detailPage = source('app/admin/projects/[projectId]/page.tsx');
    const taskPage = source('app/admin/tasks/page.tsx');

    expect(detailPage).toMatch(/notFound\(\)/);
    expect(detailPage).toMatch(/updateWorkflowPhase/);
    expect(taskPage).toMatch(/href=\{`\/admin\/projects\/\$\{projectPhases\[0\]\.project_id\}`\}/);
  });
});
