import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const repositoryRoot = join(__dirname, '..');

function source(relativePath: string): string {
  return readFileSync(join(repositoryRoot, relativePath), 'utf8');
}

describe('project cancellation UI and active list contract', () => {
  it('renders confirmation and toast through a global portal above page stacking contexts', () => {
    const notification = source('component/NotificationContext.tsx');

    expect(notification).toMatch(/createPortal\(notificationLayer, document\.body\)/);
    const overlays = source('lib/constants/overlays.ts');

    expect(notification).toMatch(/OVERLAY_Z_INDEX\.notification/);
    expect(notification).toMatch(/OVERLAY_Z_INDEX\.confirmation/);
    const notificationZIndex = Number(overlays.match(/notification: (\d+)/)?.[1]);
    const confirmationZIndex = Number(overlays.match(/confirmation: (\d+)/)?.[1]);

    expect(notificationZIndex).toBe(999999);
    expect(confirmationZIndex).toBe(999998);
    expect(notificationZIndex).toBeGreaterThan(confirmationZIndex);
    expect(notification).toMatch(/bg-black\/85/);
    expect(notification).toMatch(/role="dialog"/);
    expect(notification).toMatch(/aria-modal="true"/);
    expect(notification).toMatch(/event\.key === 'Escape'/);
  });

  it('cancels projects through the archive endpoint without hard delete', () => {
    const repository = source('services/repositories/workflowRepository.ts');
    const mutation = source('services/server/projectMutations.ts');

    expect(repository).toMatch(/\/api\/admin\/projects\/\$\{projectId\}\/archive/);
    expect(mutation).toMatch(/status: 'CANCELLED'/);
    expect(`${repository}\n${mutation}`).not.toMatch(/from\(['"]projects['"]\)\.delete|\.delete\(\)\.eq\(['"]id['"], projectId\)/);
  });

  it('loads active project lists with CANCELLED and ARCHIVED projects excluded', () => {
    const workflowService = source('services/workflowService.ts');
    const projectPage = source('app/admin/projects/page.tsx');
    const taskPage = source('app/admin/tasks/page.tsx');
    const detailPage = source('app/admin/projects/[projectId]/page.tsx');

    expect(workflowService).toMatch(/CLOSED_PROJECT_STATUSES = new Set\(\['CANCELLED', 'ARCHIVED'\]\)/);
    expect(workflowService).toMatch(/allProjects\.filter\(\(project\) => !isClosedProjectStatus\(project\.status\)\)/);
    expect(workflowService).toMatch(/visibleLegacyTasks = includeClosedProjects/);
    expect(projectPage).toMatch(/getWorkflowItems\(\{ includeClosedProjects: false \}\)/);
    expect(taskPage).toMatch(/getWorkflowItems\(\{ includeClosedProjects: false \}\)/);
    expect(detailPage).toMatch(/getWorkflowItems\(\{ includeClosedProjects: true \}\)/);
  });

  it('removes cancelled projects from active UI state before refresh completes', () => {
    const projectPage = source('app/admin/projects/page.tsx');
    const taskPage = source('app/admin/tasks/page.tsx');

    expect(projectPage).toMatch(/setItems\(\(currentItems\) => currentItems\.filter\(\(item\) => item\.project_id !== project\.id\)\)/);
    expect(taskPage).toMatch(/setTasks\(\(currentTasks\) => currentTasks\.filter\(\(item\) => item\.project_id !== targetProjectId\)\)/);
  });

  it('locks project detail mutations when the project is CANCELLED', () => {
    const detailPage = source('app/admin/projects/[projectId]/page.tsx');

    expect(detailPage).toMatch(/isProjectCancelled = String\(firstDescription\.project_status \|\| ''\)\.toUpperCase\(\) === 'CANCELLED'/);
    expect(detailPage).toMatch(/const canManageProject = hasProjectMutationAccess && !isProjectCancelled/);
    expect(detailPage).toMatch(/disabled=\{isProjectCancelled\}/);
    expect(detailPage).toMatch(/disabled=\{selectedPhase\.isLocked \|\| !canManageProject\}/);
    expect(detailPage).toMatch(/disabled=\{!canManageProject\}/);
    expect(detailPage).toMatch(/if \(isProjectCancelled\) return/);
  });
});

describe('project list request waterfall guardrails', () => {
  it('keeps the project and task list pages free of unrelated staff, attendance, account, facility, and metadata fetches', () => {
    const projectPage = source('app/admin/projects/page.tsx');
    const taskPage = source('app/admin/tasks/page.tsx');

    for (const page of [projectPage, taskPage]) {
      expect(page).not.toMatch(/from\(['"]employees['"]\)|from\(['"]attendance['"]\)|from\(['"]accounts['"]\)|from\(['"]facilities['"]\)|from\(['"]system_metadata['"]\)/);
      expect(page).not.toMatch(/\/api\/admin\/attendance|\/api\/admin\/employees|\/api\/admin\/accounts/);
    }
  });

  it('uses one batched phases request and parallel independent workflow reads', () => {
    const service = source('services/workflowService.ts');
    const repository = source('services/repositories/workflowRepository.ts');

    expect(service).toMatch(/Promise\.all\(\[/);
    expect(service).toMatch(/workflowRepository\.listPhasesByProjectIds\(projectIds\)/);
    expect(service).toMatch(/workflowRepository\.listLegacyTasks\(\)/);
    expect(repository).toMatch(/\/api\/admin\/phases/);
    expect(repository).toMatch(/body: JSON\.stringify\(\{ projectIds \}\)/);
    expect(repository).not.toMatch(/projectIds\.map\([\s\S]{0,220}\/api\/admin\/phases/);
  });

  it('selects only required columns for the active list workflow reads', () => {
    const repository = source('services/repositories/workflowRepository.ts');
    const phaseMutations = source('services/server/phaseMutations.ts');

    expect(repository).toMatch(/select\('id, project_name, drive_url, status, project_deadline, created_at'\)/);
    expect(repository).toMatch(/select\('id, project_name, drive_url, status, created_at'\)/);
    expect(repository).toMatch(/select\('id, project_name, assigned_to, current_phase, estimation_date, issue_note, packer_assigned, created_at'\)/);
    expect(phaseMutations).toMatch(/select\('id, project_id, name, order_index, created_at, status, colorway_name/);
    expect(`${repository}\n${phaseMutations}`).not.toMatch(/select\('\*'\)|select\("\*"\)/);
  });
});

describe('phase and task edit capability pre-run audit contract', () => {
  it('keeps phase edit limited to live phase columns and rejects future fields', () => {
    const repository = source('services/repositories/workflowRepository.ts');
    const phaseMutations = source('services/server/phaseMutations.ts');

    expect(phaseMutations).toMatch(/const UPDATE_PHASE_KEYS = new Set\(\['phaseName', 'orderIndex'\]\)/);
    expect(repository).toMatch(/phaseName: params\.phaseName/);
    expect(repository).toMatch(/orderIndex: params\.orderIndex/);
    expect(repository).not.toMatch(/description: params\.description|deadline: params\.deadline|assignee_employee_id/);
    expect(phaseMutations).not.toMatch(/description:|deadline:|assignee_employee_id:/);
  });

  it('renders task editing only through the Task Assignment Foundation API contract', () => {
    const detailPage = source('app/admin/projects/[projectId]/page.tsx');

    expect(detailPage).toMatch(/Task Assignment Foundation/);
    expect(detailPage).toMatch(/handleSaveTask/);
    expect(detailPage).toContain('/api/admin/projects/${projectId}/tasks');
    expect(detailPage).not.toMatch(/updateWorkflowTask|updateWorkflowTaskField/);
  });

  it('stores schema work as draft-only forward, rollback, and validation SQL', () => {
    const forwardPath = 'supabase/drafts/20260716_phase_task_edit_capability_forward_draft.sql';
    const rollbackPath = 'supabase/drafts/20260716_phase_task_edit_capability_rollback_draft.sql';
    const validationPath = 'supabase/drafts/20260716_phase_task_edit_capability_validation_draft.sql';

    expect(existsSync(join(repositoryRoot, forwardPath))).toBe(true);
    expect(existsSync(join(repositoryRoot, rollbackPath))).toBe(true);
    expect(existsSync(join(repositoryRoot, validationPath))).toBe(true);

    const forward = source(forwardPath);
    const rollback = source(rollbackPath);
    const validation = source(validationPath);

    expect(forward).toMatch(/DRAFT ONLY - DO NOT RUN WITHOUT APPROVAL/);
    expect(forward).toMatch(/alter table public\.phases/);
    expect(forward).toMatch(/alter table public\.tasks/);
    expect(forward).toMatch(/references public\.employees\(id\) on delete set null/);
    expect(forward).toMatch(/RLS impact/);
    expect(rollback).toMatch(/drop column if exists assignee_employee_id/);
    expect(validation).toMatch(/information_schema\.columns/);
    expect(validation).toMatch(/tasks_with_missing_phase/);
  });
});
