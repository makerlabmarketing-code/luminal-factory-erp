import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const state = vi.hoisted(() => ({ status: 'READY', update: vi.fn(), comment: vi.fn(), conflict: false }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/staff-task-actions', async () => import('../lib/staff-task-actions'));
vi.mock('@/services/taskAssignmentFoundation', async () => import('../lib/task-status-transitions'));
vi.mock('@/services/server/auth', () => {
  class AuthFlowError extends Error { status: number; code: string; failureStage: string; constructor(input: { message: string; status: number; code: string; failureStage: string }) { super(input.message); this.status = input.status; this.code = input.code; this.failureStage = input.failureStage; } }
  return { AuthFlowError, requireWorkspaceAccess: async () => ({ employee: { id: 2, full_name: 'Maker' } }) };
});
vi.mock('@/utils/supabase/admin', () => ({ createSupabaseAdminClient: () => ({ rpc: async (_name: string, payload: { p_next_status: string; p_change_deadline: boolean }) => { state.update({ status: payload.p_next_status, ...(payload.p_change_deadline ? { deadline: 'changed' } : {}) }); return { data: state.conflict ? { success: false, code: 'stale_task' } : { success: true, status: payload.p_next_status, deadline: '2026-10-30' }, error: null }; }, from: (table: string) => {
  let updating = false;
  const query = {
    select: () => query, eq: () => query, is: () => query,
    update: (payload: unknown) => { updating = true; state.update(payload); return query; },
    maybeSingle: async () => ({ data: table === 'projects' ? { status: 'PROCESSING' } : updating ? state.conflict ? null : { id: 1 } : { id: 1, project_id: 4, assignee_employee_id: 2, status: state.status, deadline: '2026-10-30' }, error: null }),
    limit: async () => ({ data: [{ id: 1 }], error: null }),
    insert: state.comment,
  };
  return query;
} }) }));
import { PATCH } from '../app/api/staff/tasks/route';
beforeEach(() => { vi.clearAllMocks(); state.status = 'READY'; state.conflict = false; state.comment.mockResolvedValue({ error: null }); });
const patch = (status: string, note?: string) => PATCH(new NextRequest('https://erp.test/api/staff/tasks', { method: 'PATCH', body: JSON.stringify({ taskId: 1, status, ...(note === undefined ? {} : { note }) }) }));

describe('staff quick actions', () => {
  it('starts assigned work without a compulsory report or deadline change', async () => {
    expect((await patch('IN_PROGRESS')).status).toBe(200);
    expect(state.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'IN_PROGRESS' }));
    expect(state.update.mock.calls[0][0]).not.toHaveProperty('deadline');
    expect(state.comment).not.toHaveBeenCalled();
  });
  it('submits completed effort for review without staff self-approval', async () => {
    state.status = 'IN_PROGRESS';
    expect((await patch('PENDING_REVIEW')).status).toBe(200);
    state.status = 'PENDING_REVIEW';
    expect((await patch('APPROVED')).status).toBe(422);
  });
  it('requires a reason for blocked work and rejects stale concurrent updates', async () => {
    state.status = 'IN_PROGRESS';
    expect((await patch('BLOCKED')).status).toBe(422);
    expect(state.update).not.toHaveBeenCalled();
    state.conflict = true;
    expect((await patch('PENDING_REVIEW')).status).toBe(409);
  });
});
