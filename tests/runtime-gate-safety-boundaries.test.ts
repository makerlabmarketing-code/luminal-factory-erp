import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const source = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const gates = [
  'FACILITY_ACTIVE_STATE_ENABLED',
  'PHASE_WORKFLOW_FOUNDATION_ENABLED',
  'PHASE_STATUS_MUTATION_ENABLED',
  'PROJECT_WORKFLOW_ATOMIC_CREATE_ENABLED',
  'TASK_ASSIGNMENT_ATOMIC_CREATE_ENABLED',
  'TASK_COMMENTS_ACTIVITY_ENABLED',
  'ATTENDANCE_RECOVERY_ENABLED',
] as const;

describe('runtime gate server authority', () => {
  it('does not expose any runtime authority through NEXT_PUBLIC variables', () => {
    const files = [
      'services/server/adminFacilities.ts',
      'services/server/phaseMutations.ts',
      'services/server/projectMutations.ts',
      'services/server/taskAssignmentFoundation.ts',
      'services/server/projectActivity.ts',
      'app/api/admin/attendance/route.ts',
    ];
    const combined = files.map(source).join('\n');
    for (const gate of gates) {
      expect(combined).not.toContain(`NEXT_PUBLIC_${gate}`);
    }
  });

  it('requires exact server true values and returns controlled disabled responses', () => {
    const facility = source('services/server/adminFacilities.ts');
    const phases = source('services/server/phaseMutations.ts');
    const projects = source('services/server/projectMutations.ts');
    const tasks = source('services/server/taskAssignmentFoundation.ts');
    const timeline = source('services/server/projectActivity.ts');
    const attendance = source('app/api/admin/attendance/route.ts');

    expect(facility).toMatch(/process\.env\.FACILITY_ACTIVE_STATE_ENABLED === 'true'/);
    expect(facility).toMatch(/assertFacilityMutationEnabled\(\)[\s\S]*Chức năng cập nhật cơ sở đang chờ kích hoạt\./);
    expect(phases).toMatch(/process\.env\.PHASE_WORKFLOW_FOUNDATION_ENABLED === 'true'/);
    expect(phases).toMatch(/process\.env\.PHASE_STATUS_MUTATION_ENABLED !== 'true'[\s\S]*live_approval_required/);
    expect(projects).toMatch(/process\.env\.PROJECT_WORKFLOW_ATOMIC_CREATE_ENABLED === 'true'/);
    expect(projects).toMatch(/workflowCreated:\s*false[\s\S]*phasesCreated:\s*0[\s\S]*tasksCreated:\s*0/);
    expect(tasks).toMatch(/process\.env\.TASK_ASSIGNMENT_ATOMIC_CREATE_ENABLED !== "true"[\s\S]*Chức năng thêm công việc đang chờ kích hoạt\./);
    expect(timeline).toMatch(/process\.env\.TASK_COMMENTS_ACTIVITY_ENABLED === 'true'/);
    expect(timeline).toMatch(/capabilityEnabled:\s*false,\s*canComment:\s*false/);
    expect(attendance).toMatch(/isAttendanceManualMutationEnabled\(\)/);
    expect(attendance).toMatch(/attendance_manual_mutation_disabled[\s\S]*Điều chỉnh chấm công đang chờ kích hoạt\./);
  });

  it('keeps disabled states honest and readable without hidden writes', () => {
    const facilityPage = source('app/admin/facilities/page.tsx');
    const projectPage = source('app/admin/projects/page.tsx');
    const projectDetail = source('app/admin/projects/[projectId]/page.tsx');
    const timeline = source('app/admin/projects/[projectId]/ProjectTimelineSection.tsx');
    const attendancePage = source('app/admin/attendance/page.tsx');

    expect(facilityPage).toContain('Chức năng cập nhật cơ sở đang chờ kích hoạt.');
    expect(projectPage).toMatch(/workflowCreationAvailable \? draftStages : \[\]/);
    expect(projectPage).toMatch(/Thiết lập sau tại chi tiết dự án/);
    expect(projectDetail).toContain('Chức năng thêm công việc đang chờ kích hoạt.');
    expect(timeline).toContain('Bình luận và lịch sử hoạt động đang chờ kích hoạt.');
    expect(attendancePage).toMatch(/disabled[\s\S]*Điều chỉnh chấm công đang chờ xác nhận/);
  });

  it('revokes direct browser execution from atomic RPC packages', () => {
    const projectRpc = source('supabase/drafts/20260721_project_creation_atomic_rpc_forward.sql');
    const taskRpc = source('supabase/drafts/20260721_task_assignment_atomic_create_rpc.sql');
    for (const sql of [projectRpc, taskRpc]) {
      expect(sql).toMatch(/revoke all on function[\s\S]*from public, anon, authenticated/i);
      expect(sql).toMatch(/grant execute on function[\s\S]*to service_role/i);
      expect(sql).not.toMatch(/grant execute on function[\s\S]*to authenticated/i);
    }
  });
});
