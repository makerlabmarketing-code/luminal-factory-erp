import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  TaskAssignmentValidationError,
  validateTaskAssignmentAssignPayload,
  validateTaskAssignmentCreatePayload,
  validateTaskAssignmentStatusPayload,
  validateTaskAssignmentUpdatePayload,
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

  it('exposes route contracts but leaves writes behind the migration feature gate', () => {
    const service = source('services/server/taskAssignmentFoundation.ts');
    const listRoute = source('app/api/admin/projects/[projectId]/tasks/route.ts');
    const patchRoute = source('app/api/admin/projects/[projectId]/tasks/[taskId]/route.ts');
    const assignRoute = source('app/api/admin/projects/[projectId]/tasks/[taskId]/assign/route.ts');
    const statusRoute = source('app/api/admin/projects/[projectId]/tasks/[taskId]/status/route.ts');

    expect(service).toMatch(/TASK_ASSIGNMENT_FOUNDATION_ENABLED/);
    expect(service).toMatch(/task_assignment_migration_required/);
    expect(service).toMatch(/task_assignment_repository_not_implemented/);
    expect(service).toMatch(/Task Assignment repository chưa được kết nối/);
    expect(service).toMatch(/return assertTaskAssignmentRepositoryAvailable\(\)/);
    expect(service).not.toMatch(/return \{ success: true/);
    expect(service).toMatch(/requireProjectMembershipAction\(projectId, 'TASK_MANAGE'\)/);
    expect(listRoute).toMatch(/export async function GET/);
    expect(listRoute).toMatch(/export async function POST/);
    expect(patchRoute).toMatch(/export async function PATCH/);
    expect(assignRoute).toMatch(/export async function POST/);
    expect(statusRoute).toMatch(/export async function POST/);
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
