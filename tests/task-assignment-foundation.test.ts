import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  TaskAssignmentValidationError,
  validateTaskAssignmentAssignPayload,
  validateTaskAssignmentCreatePayload,
  validateTaskAssignmentStatusPayload,
  validateTaskAssignmentUpdatePayload,
  canTransitionTaskStatus,
} from '../services/taskAssignmentFoundation';

const repositoryRoot = join(__dirname, '..');

function source(relativePath: string): string {
  return readFileSync(join(repositoryRoot, relativePath), 'utf8');
}

describe('Task Assignment Foundation contracts', () => {
  it('validates create payloads without accepting actor or project authority from the client', () => {
    expect(
      validateTaskAssignmentCreatePayload({
        title: 'In test mẫu',
        phaseId: 10,
        parentTaskId: null,
        assigneeEmployeeId: 3,
        deadline: '2026-07-30',
        comment: 'Ưu tiên trong tuần',
      })
    ).toMatchObject({
      title: 'In test mẫu',
      phaseId: 10,
      assigneeEmployeeId: 3,
    });

    expect(() => validateTaskAssignmentCreatePayload({ title: 'A', actorEmployeeId: 3 })).toThrow(
      TaskAssignmentValidationError
    );
    expect(() => validateTaskAssignmentCreatePayload({ title: 'A', projectId: 1 })).toThrow(
      TaskAssignmentValidationError
    );
  });

  it('validates update, assign and status payloads with whitelists', () => {
    expect(validateTaskAssignmentUpdatePayload({ title: 'Sửa tên', deadline: null })).toEqual({
      title: 'Sửa tên',
      deadline: null,
    });
    expect(validateTaskAssignmentAssignPayload({ assigneeEmployeeId: null, comment: 'Bỏ người làm' })).toEqual({
      assigneeEmployeeId: null,
      comment: 'Bỏ người làm',
    });
    expect(validateTaskAssignmentStatusPayload({ status: 'IN_PROGRESS' })).toEqual({
      status: 'IN_PROGRESS',
      comment: null,
    });
    expect(() => validateTaskAssignmentStatusPayload({ status: 'DONE' })).toThrow(TaskAssignmentValidationError);
  });

  it('exposes route contracts and keeps writes behind the migration feature gate', () => {
    const service = source('services/server/taskAssignmentFoundation.ts');
    const listRoute = source('app/api/admin/projects/[projectId]/tasks/route.ts');
    const patchRoute = source('app/api/admin/projects/[projectId]/tasks/[taskId]/route.ts');
    const assignRoute = source('app/api/admin/projects/[projectId]/tasks/[taskId]/assign/route.ts');
    const statusRoute = source('app/api/admin/projects/[projectId]/tasks/[taskId]/status/route.ts');

    expect(service).toMatch(/TASK_ASSIGNMENT_FOUNDATION_ENABLED/);
    expect(service).toMatch(/task_assignment_migration_required/);
    expect(service).toMatch(/createSupabaseAdminClient/);
    expect(service).toMatch(/assertTaskSchemaReady/);
    expect(service).toMatch(/task_assignment_migration_required/);
    expect(service).toMatch(/task_assignment_atomic_create_required/);
    expect(service).toMatch(/Không thể cập nhật công việc dự án/);
    expect(service).toMatch(/Không thể giao công việc dự án/);
    expect(service).toMatch(/Không thể đổi trạng thái công việc dự án/);
    expect(service).not.toMatch(/task_assignment_repository_not_implemented/);
    expect(service).toMatch(/requireProjectMembershipAction\(projectId, ["']TASK_MANAGE["']\)/);
    expect(service).toMatch(/canManageTasks/);
    expect(service).toMatch(/assignee_employee_id["'], context\.actorEmployeeId/);
    expect(listRoute).toMatch(/export async function GET/);
    expect(listRoute).toMatch(/export async function POST/);
    expect(patchRoute).toMatch(/export async function PATCH/);
    expect(assignRoute).toMatch(/export async function POST/);
    expect(statusRoute).toMatch(/export async function POST/);
  });



  it('enforces review-remediation task assignment workflow contracts', () => {
    const service = source('services/server/taskAssignmentFoundation.ts');

    expect(canTransitionTaskStatus('BACKLOG', 'READY')).toBe(true);
    expect(canTransitionTaskStatus('BACKLOG', 'COMPLETED')).toBe(false);
    expect(canTransitionTaskStatus('COMPLETED', 'IN_PROGRESS')).toBe(false);
    expect(() => validateTaskAssignmentAssignPayload({ comment: 'Thiếu người làm' })).toThrow(TaskAssignmentValidationError);
    expect(service).toMatch(/assignee:assignee_employee_id!tasks_assignee_employee_id_fkey/);
    expect(service).toMatch(/project_members_employee_id_fkey/);
    expect(service).toMatch(/employeeStatus === "INACTIVE"/);
    expect(service).toMatch(/employeeStatus === "LOCKED"/);
    expect(service).toMatch(/task_assignment_parent_cycle/);
    expect(service).toMatch(/changedFields.length === 0/);
    expect(service).toMatch(/currentTask.status === payload.status/);
    expect(service).toMatch(/TASK_UPDATED/);
    expect(service).toMatch(/STATUS_CHANGED/);
    expect(service).toMatch(/oldStatus/);
    expect(service).toMatch(/newStatus/);
    expect(source('lib/workflow-project-phase.ts')).toMatch(/task-status-transitions/);
    expect(source('services/taskAssignmentFoundation.ts')).toMatch(/task-status-transitions/);
  });

  it('wires project detail to normalized task assignment without extra employee-list fetches', () => {
    const projectDetail = source('app/admin/projects/[projectId]/page.tsx');

    expect(projectDetail).toMatch(/TaskAssignmentDTO/);
    expect(projectDetail).toContain('/api/admin/projects/${projectId}/tasks');
    expect(projectDetail).toMatch(/task\.commentCount/);
    expect(projectDetail).toMatch(/task\.progressPercent/);
    expect(projectDetail).toMatch(/<textarea/);
    expect(projectDetail).toMatch(/activeProjectMembers/);
    expect(projectDetail).not.toMatch(/scope=assignable/);
    expect(projectDetail).not.toMatch(/type=\"number\"[^>]+comment/i);
  });

  it('prepares migration, rollback, validation and backfill artifacts without executing SQL', () => {
    const forward = source('supabase/drafts/20260720_task_assignment_foundation_forward.sql');
    const rollback = source('supabase/drafts/20260720_task_assignment_foundation_rollback.sql');
    const validation = source('supabase/drafts/20260720_task_assignment_foundation_validation.sql');
    const backfill = source('supabase/drafts/20260720_task_assignment_foundation_backfill_strategy.md');

    expect(forward).toMatch(/DRAFT ONLY - DO NOT RUN WITHOUT LIVE APPROVAL/);
    expect(forward).toMatch(/assignee_employee_id bigint references public\.employees\(id\)/);
    expect(forward).toMatch(/task_comments/);
    expect(forward).toMatch(/project_activity/);
    expect(forward).toMatch(/task_notifications/);
    expect(forward).toMatch(/to_regprocedure\('public\.can_view_project\(bigint\)'\)/);
    expect(forward).toMatch(/task_id bigint references public\.tasks\(id\) on delete set null/);
    expect(rollback).toMatch(/drop table if exists public\.task_notifications/);
    expect(validation).toMatch(/assigned_tasks_without_active_membership/);
    expect(validation).toMatch(/tasks_with_parent_project_mismatch/);
    expect(validation).toMatch(/task_hierarchy_cycles/);
    expect(validation).toMatch(/missing_index/);
    expect(validation).toMatch(/cmd in \('INSERT', 'UPDATE', 'DELETE', 'ALL'\)/);
    expect(backfill).toMatch(/Leave ambiguous values null and emit conflict rows/);
    expect(backfill).toMatch(/Do not infer comments, activity, or notifications automatically/);
  });
});
