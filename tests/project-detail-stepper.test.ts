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
    expect(detailPage).toMatch(/selectedPhase\.gateMessage/);
    expect(detailPage).toMatch(/Chỉ xem/);
  });

  it('shows manual unlock only as a manager capability placeholder, not staff mutation', () => {
    const detailPage = source('app/admin/projects/[projectId]/page.tsx');

    expect(detailPage).toMatch(/function canShowManualUnlockAction\(canManageProject: boolean, phase: PhaseRecord\)/);
    expect(detailPage).toMatch(/canManageProject && phase\.status === 'LOCKED'/);
    expect(detailPage).toMatch(/Mở khóa giai đoạn/);
    expect(detailPage).toMatch(/BLOCKED_BY_PHASE_WORKFLOW_ROLLOUT/);
    expect(detailPage).toMatch(/disabled\s+aria-disabled="true"/);
  });

  it('renders only the selected phase detail panel instead of all vertical cards', () => {
    const detailPage = source('app/admin/projects/[projectId]/page.tsx');

    expect(detailPage).toMatch(/\{selectedPhase && \(/);
    expect(detailPage).toMatch(/selectedPhase\.phaseName/);
    expect(detailPage).not.toMatch(/Timeline giai đoạn/);
  });

  it('keeps phase detail and task cards responsive without duplicating business logic', () => {
    const detailPage = source('app/admin/projects/[projectId]/page.tsx');
    const membershipSection = source('app/admin/projects/[projectId]/ProjectMembershipSection.tsx');

    expect(detailPage).toMatch(/function ProjectDetailField/);
    expect(detailPage).toMatch(/function TaskMobileField/);
    expect(detailPage).toMatch(/xl:grid-cols-\[minmax\(0,1fr\)_360px\]/);
    expect(detailPage).toMatch(/xl:sticky xl:top-4 xl:self-start/);
    expect(detailPage).toMatch(/<dl className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2 xl:grid-cols-4">/);
    expect(detailPage).toMatch(/<article key=\{getTaskKey\(task\)\}/);
    expect(detailPage).toMatch(/<TaskMobileField label="Người phụ trách" value=\{getTaskAssigneeLabel\(task\)\} \/>/);
    expect(detailPage).toMatch(/className="mt-3 w-full rounded border border-slate-700 px-2 py-2 font-bold text-slate-300"/);
    expect(membershipSection).toMatch(/<table className="w-full min-w-\[760px\] text-left text-xs">/);
    expect(membershipSection).toContain("member.isAssignable ? 'Có thể giao việc' : 'Không khả dụng'");
  });

  it('renders task assignee and packer text through explicit helper fallbacks', () => {
    const detailPage = source('app/admin/projects/[projectId]/page.tsx');

    expect(detailPage).toMatch(/function getTaskAssigneeLabel\(task: DisplayTask\): string/);
    expect(detailPage).toMatch(/task\.assignedEmployee\?\.fullName \|\| task\.assignedToText \|\| 'Chưa phân công'/);
    expect(detailPage).toMatch(/function getTaskPackerLabel\(task: DisplayTask\): string \| null/);
    expect(detailPage).toMatch(/task\.packerEmployee\?\.fullName \|\| task\.packerAssignedText \|\| null/);
    expect(detailPage).toMatch(/Người phụ trách: \{getTaskAssigneeLabel\(task\)\}/);
    expect(detailPage).toMatch(/Người đóng gói: \{getTaskPackerLabel\(task\) \|\| 'Chưa gán'\}/);
  });

  it('maps legacy tasks to matching phase text and keeps unmatched tasks in fallback group', () => {
    const detailPage = source('app/admin/projects/[projectId]/page.tsx');

    expect(detailPage).toMatch(/function mapLegacyTasksToPhaseGroups/);
    expect(detailPage).toMatch(/normalizePhaseKey\(task\.currentPhaseText \|\| task\.status\)/);
    expect(detailPage).toMatch(/const groupKey: PhaseTaskGroupKey = phaseId \|\| 'unassigned'/);
    expect(detailPage).toMatch(/Công việc chưa phân giai đoạn/);
  });

  it('shows project progress from phase and task progress with current active phase', () => {
    const detailPage = source('app/admin/projects/[projectId]/page.tsx');
    const workflow = source('lib/workflow-project-phase.ts');

    expect(detailPage).toMatch(/const completedPhaseCount = phasesWithGates\.filter\(\(phase\) => phase\.status === 'COMPLETED'\)\.length/);
    expect(detailPage).toMatch(/const progressPercent = calculateProjectProgress\(phasesWithGates\.map\(\(phase\) => phase\.progressPercent\)\)/);
    expect(workflow).toMatch(/function calculatePhaseProgress/);
    expect(workflow).toMatch(/function calculateProjectProgress/);
    expect(detailPage).toMatch(/Tiến độ dự án/);
    expect(detailPage).toMatch(/currentPhaseId: activePhase\?\.item\.phase_id \|\| null/);
  });

  it('does not expose raw database errors and does not fetch employees only to render legacy text', () => {
    const detailPage = source('app/admin/projects/[projectId]/page.tsx');
    const repository = source('services/repositories/workflowRepository.ts');

    expect(detailPage).toMatch(/Không thể tải thông tin dự án/);
    expect(detailPage).not.toMatch(/PGRST|42703|schema cache|column .* does not exist/);
    expect(detailPage).not.toMatch(/getActiveEmployees|findEmployeeByIdentifier|findEmployeeByName|employees\.map/);
    expect(repository).toMatch(/select\('id, project_name, assigned_to, current_phase, estimation_date, issue_note, packer_assigned, created_at'\)/);
  });

  it('keeps project create/detail route contracts in place', () => {
    const detailPage = source('app/admin/projects/[projectId]/page.tsx');
    const taskPage = source('app/admin/tasks/page.tsx');

    expect(detailPage).toMatch(/notFound\(\)/);
    expect(detailPage).toMatch(/updateWorkflowPhase/);
    expect(taskPage).toMatch(/redirect\(`\/admin\/projects/);
  });
});
