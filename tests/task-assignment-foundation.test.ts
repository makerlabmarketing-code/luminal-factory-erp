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
    expect(validateTaskAssignmentAssignPayload({ assigneeEmployeeId: null, comment: 'Bỏ người làm' })).toMatchObject({
      assigneeEmployeeId: null,
      comment: 'Bỏ người làm',
    });
    expect(validateTaskAssignmentStatusPayload({ status: 'IN_PROGRESS' })).toMatchObject({
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
    expect(service).toMatch(/TASK_ASSIGNMENT_ATOMIC_CREATE_ENABLED/);
    expect(service).toMatch(/\.rpc\("create_project_task_atomic"/);
    expect(service).toMatch(/p_actor_employee_id: context\.actorEmployeeId/);
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


  it('skips unchanged task edit requests before server validation seams', () => {
    const projectDetail = source('app/admin/projects/[projectId]/page.tsx');
    const saveTaskBody = projectDetail.slice(projectDetail.indexOf('const handleSaveTask'), projectDetail.indexOf('const handleSavePhase'));
    const serverService = source('services/server/taskAssignmentFoundation.ts');
    const assignBody = serverService.slice(serverService.indexOf('export async function assignProjectTask'), serverService.indexOf('export async function changeProjectTaskStatus'));

    expect(saveTaskBody).toMatch(/describeTaskEditIntent/);
    expect(saveTaskBody).toMatch(/!hasTaskEditChanges\(editIntent\)/);
    expect(saveTaskBody).toMatch(/if \(editIntent\.hasAssigneeChange\)[\s\S]*\/assign/);
    expect(saveTaskBody).toMatch(/if \(editIntent\.hasDeadlineChange \|\| hasContentChange[\s\S]*method: 'PATCH'/);
    expect(saveTaskBody).toMatch(/if \(editIntent\.hasStatusChange\)[\s\S]*\/status/);
    expect(assignBody.indexOf('currentTask.assigneeEmployeeId === payload.assigneeEmployeeId')).toBeLessThan(assignBody.indexOf('assertAssigneeActiveMember'));
  });

  it('wires project detail to normalized task assignment without extra employee-list fetches', () => {
    const projectDetail = source('app/admin/projects/[projectId]/page.tsx');

    expect(projectDetail).toMatch(/TaskAssignmentDTO/);
    expect(projectDetail).toContain('/api/admin/projects/${projectId}/tasks');
    expect(projectDetail).toMatch(/task\.commentCount/);
    expect(projectDetail).toMatch(/task\.progressPercent/);
    expect(projectDetail).toMatch(/<textarea/);
    expect(projectDetail).toMatch(/activeProjectMembers/);
    expect(projectDetail).toMatch(/Chức năng thêm công việc đang chờ kích hoạt/);
    expect(projectDetail).toMatch(/handleCreateTask/);
    expect(projectDetail).toMatch(/await refreshTasks\(\)/);
    expect(projectDetail).toMatch(/Vui lòng nhập tên công việc/);
    expect(projectDetail).toMatch(/Người duyệt chưa được hỗ trợ/);
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

  it('delivers a hardened service-role-only atomic task-create package', () => {
    const migration = source('supabase/migrations/20260815165046_task_assignment_atomic_create.sql');
    const preRun = source('supabase/validation/20260815165046_task_assignment_atomic_create_pre_run.sql');
    const validation = source('supabase/validation/20260815165046_task_assignment_atomic_create_validation.sql');
    const rollback = source('supabase/rollbacks/20260815165046_task_assignment_atomic_create_rollback.sql');
    const serverService = source('services/server/taskAssignmentFoundation.ts');

    expect(migration).toMatch(/security invoker/i);
    expect(migration).toMatch(/set search_path = public, pg_temp/i);
    expect(migration).toMatch(/p_deadline timestamptz/i);
    expect(migration).toMatch(/for update/i);
    expect(migration).toMatch(/task_assignment_permission_forbidden/);
    expect(migration).toMatch(/task_assignment_project_closed/);
    expect(migration).toMatch(/task_assignment_phase_invalid/);
    expect(migration).toMatch(/task_assignment_parent_invalid/);
    expect(migration).toMatch(/task_assignment_assignee_invalid/);
    expect(migration).toMatch(/revoke all on function[\s\S]*from public, anon, authenticated/i);
    expect(migration).toMatch(/grant execute on function[\s\S]*to service_role/i);
    expect(migration).not.toMatch(/grant execute on function[\s\S]*to authenticated/i);
    expect(preRun).toMatch(/begin transaction read only/i);
    expect(preRun).toMatch(/superseded_date_rpc/);
    expect(validation).toMatch(/public_can_execute/);
    expect(validation).toMatch(/invalid_assigned_tasks/);
    expect(validation).toMatch(/cross_project_phase_tasks/);
    expect(validation).toMatch(/cross_project_parent_tasks/);
    expect(validation).toMatch(/no partial rows/i);
    expect(rollback).toMatch(/Existing tasks and side-effect rows[\s\S]*retained/i);
    expect(serverService).toMatch(/mapAtomicCreateError/);
    expect(serverService).toMatch(/task_assignment_project_closed/);
    expect(serverService).toMatch(/task_assignment_assignee_invalid/);
  });
});
