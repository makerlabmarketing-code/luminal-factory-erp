import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { NextRequest } from 'next/server';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';

const fixture = vi.hoisted(() => ({
  managerId: 1,
  staffId: 2,
  query: vi.fn(),
}));

const { FixtureAuthFlowError } = vi.hoisted(() => ({
  FixtureAuthFlowError: class extends Error {
    status: number;
    code: string;
    failureStage: string;
    constructor(input: { message: string; status: number; code: string; failureStage: string }) {
      super(input.message);
      this.status = input.status;
      this.code = input.code;
      this.failureStage = input.failureStage;
    }
  },
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/staff-task-actions', () => import('../lib/staff-task-actions'));
vi.mock('@/lib/task-status-transitions', () => import('../lib/task-status-transitions'));
vi.mock('@/services/taskAssignmentFoundation', () => import('../services/taskAssignmentFoundation'));
vi.mock('@/services/server/taskAssignmentFoundation', () => import('../services/server/taskAssignmentFoundation'));
vi.mock('@/services/server/auth', () => ({
  AuthFlowError: FixtureAuthFlowError,
  requireWorkspaceAccess: async () => ({ employee: { id: fixture.staffId, full_name: 'Nhân viên thử' } }),
}));
vi.mock('@/services/server/projectMembershipAuthorization', () => ({
  requireProjectMembershipAction: async (projectId: number, action: string) => {
    const { rows } = await fixture.query(
      "select id from project_members where project_id = $1 and employee_id = $2 and role_code = 'PROJECT_MANAGER' and status = 'ACTIVE'",
      [projectId, fixture.managerId],
    );
    if (action !== 'TASK_MANAGE' || rows.length === 0) {
      throw new FixtureAuthFlowError({
        status: 403, code: 'permission_forbidden', message: 'Không có quyền quản lý công việc.',
        failureStage: 'permission_check',
      });
    }
    return { actorEmployeeId: fixture.managerId };
  },
}));
vi.mock('@/utils/supabase/admin', () => ({
  createSupabaseAdminClient: () => ({
    rpc: async (name: string, params: Record<string, unknown>) => {
      expect(name).toBe('update_staff_checklist_task');
      const { rows } = await fixture.query('select update_staff_checklist_task($1,$2,$3,$4,$5,$6,$7) as result', [
        params.p_task_id, params.p_employee_id, params.p_expected_status, params.p_next_status,
        params.p_note, params.p_deadline, params.p_change_deadline,
      ]);
      return { data: rows[0].result, error: null };
    },
    from: (table: string) => {
      const filters: Array<[string, unknown]> = [];
      let update: Record<string, unknown> | undefined;
      const run = async (limit?: number) => {
        const where = filters.map(([column], i) => `${column} = $${i + 1}`).join(' and ');
        const values = filters.map(([, value]) => value);
        if (update) {
          const columns = Object.keys(update);
          await fixture.query(
            `update ${table} set ${columns.map((column, i) => `${column} = $${i + values.length + 1}`).join(', ')} where ${where}`,
            [...values, ...Object.values(update)],
          );
          return { data: [], error: null };
        }
        const { rows } = await fixture.query(
          `select * from ${table}${where ? ` where ${where}` : ''}${limit ? ` limit ${limit}` : ''}`,
          values,
        );
        return { data: rows, error: null };
      };
      const query = {
        select: () => query,
        eq: (column: string, value: unknown) => { filters.push([column, value]); return query; },
        limit: (limit: number) => run(limit),
        maybeSingle: async () => { const result = await run(1); return { data: result.data[0] ?? null, error: null }; },
        update: (values: Record<string, unknown>) => { update = values; return query; },
        then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => run().then(resolve, reject),
        insert: async ([record]: Array<Record<string, unknown>>) => {
          const columns = Object.keys(record);
          await fixture.query(
            `insert into ${table} (${columns.join(', ')}) values (${columns.map((_, i) => `$${i + 1}`).join(', ')})`,
            Object.values(record),
          );
          return { error: null };
        },
      };
      return query;
    },
  }),
}));

import { PATCH as updateStaffTask } from '../app/api/staff/tasks/route';
import { POST as reviewTask } from '../app/api/admin/projects/[projectId]/tasks/[taskId]/status/route';

const db = new PGlite();
beforeAll(async () => {
  vi.stubEnv('TASK_ASSIGNMENT_FOUNDATION_ENABLED', 'true');
  fixture.query.mockImplementation((sql: string, params: unknown[]) => db.query(sql, params));
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create table employees(id bigint primary key, status text, is_active boolean);
    create table projects(id bigint primary key, status text, project_deadline date);
    create table project_members(id bigint generated always as identity, project_id bigint, employee_id bigint, role_code text, status text);
    create table tasks(
      id bigint primary key, project_id bigint, phase_id bigint, parent_task_id bigint, title text, description text,
      assignee_employee_id bigint, deadline timestamptz, status text, updated_by_employee_id bigint,
      updated_at timestamptz, completed_at timestamptz
    );
    create table task_comments(id bigint generated always as identity, project_id bigint, task_id bigint, employee_id bigint, body text);
    create table project_activity(id bigint generated always as identity, project_id bigint, task_id bigint, actor_employee_id bigint, activity_type text, payload jsonb);
    insert into employees values (1,'ACTIVE',true),(2,'ACTIVE',true);
    insert into projects values (7,'ACTIVE','2026-12-15');
    insert into project_members(project_id,employee_id,role_code,status) values
      (7,1,'PROJECT_MANAGER','ACTIVE'),(7,2,'PROJECT_CONTRIBUTOR','ACTIVE');
    insert into tasks(id, project_id, title, assignee_employee_id, status) values (21,7,'Checklist thử',2,'READY');
  `);
  const source = readFileSync('supabase/migrations/20261018152856_project_checklist_atomic.sql', 'utf8');
  const signature = 'create or replace function public.update_staff_checklist_task(';
  const start = source.indexOf(signature);
  const grant = 'grant execute on function public.update_staff_checklist_task(bigint,bigint,text,text,text,timestamptz,boolean) to service_role;';
  const end = source.indexOf(grant, start);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  await db.exec(source.slice(start, end + grant.length));
});
afterAll(async () => {
  vi.unstubAllEnvs();
  await db.close();
});

const request = (path: string, method: string, body: object) =>
  new NextRequest(`https://erp.test${path}`, { method, body: JSON.stringify(body) });
const staff = (expectedStatus: string, status: string, note = '') =>
  updateStaffTask(request('/api/staff/tasks', 'PATCH', { taskId: 21, expectedStatus, status, note }));
const manager = (status: string, comment: string) =>
  reviewTask(request('/api/admin/projects/7/tasks/21/status', 'POST', { status, comment }), {
    params: Promise.resolve({ projectId: '7', taskId: '21' }),
  });

it('keeps the staff submission, rejected stale view, manager revision, resubmission and approval in one stored history', async () => {
  expect((await staff('READY', 'IN_PROGRESS')).status).toBe(200);
  expect((await staff('READY', 'IN_PROGRESS', 'Ghi chú từ phiên cũ')).status).toBe(409);
  expect((await staff('IN_PROGRESS', 'PENDING_REVIEW', 'Đã làm bản đầu')).status).toBe(200);
  expect((await staff('PENDING_REVIEW', 'APPROVED')).status).toBe(422);

  fixture.managerId = 2;
  expect((await manager('REVISION_REQUIRED', 'Bình luận bị từ chối')).status).toBe(403);
  fixture.managerId = 1;
  expect((await manager('REVISION_REQUIRED', 'Cần sửa bề mặt')).status).toBe(200);
  expect((await staff('REVISION_REQUIRED', 'IN_PROGRESS')).status).toBe(200);
  expect((await staff('IN_PROGRESS', 'PENDING_REVIEW')).status).toBe(200);
  expect((await manager('APPROVED', 'Đã kiểm tra bản sửa')).status).toBe(200);
  expect((await staff('APPROVED', 'COMPLETED')).status).toBe(200);

  expect((await db.query('select status, completed_at is not null as completed from tasks where id = 21')).rows)
    .toEqual([{ status: 'COMPLETED', completed: true }]);
  expect((await db.query('select employee_id, body from task_comments where task_id = 21 order by id')).rows)
    .toEqual([
      { employee_id: 2, body: 'Đã làm bản đầu' },
      { employee_id: 1, body: 'Cần sửa bề mặt' },
      { employee_id: 1, body: 'Đã kiểm tra bản sửa' },
    ]);
  expect((await db.query("select actor_employee_id, payload->>'newStatus' as status from project_activity where task_id = 21 order by id")).rows)
    .toEqual([
      { actor_employee_id: 2, status: 'IN_PROGRESS' },
      { actor_employee_id: 2, status: 'PENDING_REVIEW' },
      { actor_employee_id: 1, status: 'REVISION_REQUIRED' },
      { actor_employee_id: 2, status: 'IN_PROGRESS' },
      { actor_employee_id: 2, status: 'PENDING_REVIEW' },
      { actor_employee_id: 1, status: 'APPROVED' },
      { actor_employee_id: 2, status: 'COMPLETED' },
    ]);
}, 15_000);
