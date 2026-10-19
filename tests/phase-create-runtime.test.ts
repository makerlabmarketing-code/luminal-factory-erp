import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ authorize: vi.fn(), insert: vi.fn(), single: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/utils/supabase/admin', () => ({ createSupabaseAdminClient: () => ({ from: () => ({ insert: state.insert }) }) }));
vi.mock('@/services/server/phaseAuthorization', () => ({ requirePhaseMutationAccess: state.authorize }));
vi.mock('@/services/server/auth', () => ({ AuthFlowError: class extends Error {
  status: number;
  constructor(input: { message: string; status: number }) { super(input.message); this.status = input.status; }
} }));
vi.mock('@/lib/workflow-project-phase', () => import('../lib/workflow-project-phase'));
import { createPhase } from '../services/server/phaseMutations';

beforeEach(() => {
  vi.resetAllMocks();
  state.authorize.mockResolvedValue({ actorEmployeeId: 7 });
  state.insert.mockReturnValue({ select: () => ({ single: state.single }) });
  state.single.mockResolvedValue({ data: { id: 42 }, error: null });
});

describe('minimal phase creation against defaulted NOT NULL fields', () => {
  it('accepts name/order only and never inserts null progress/review', async () => {
    await expect(createPhase('12', { phaseName: '  In thử  ', orderIndex: 3 })).resolves.toEqual({ success: true, phaseId: 42 });
    expect(state.authorize).toHaveBeenCalledWith({ projectId: 12, action: 'PHASE_CREATE' });
    expect(state.insert.mock.calls[0][0][0]).toMatchObject({ project_id: 12, name: 'In thử', order_index: 3, progress: 0, required_review: false });
  });
  it('preserves explicit template progress and review values', async () => {
    await createPhase('12', { phaseName: 'Kiểm tra', orderIndex: 4, progress: 25, requiredReview: true });
    expect(state.insert.mock.calls[0][0][0]).toMatchObject({ progress: 25, required_review: true });
  });
  it('rejects invalid fields before creating a record', async () => {
    for (const body of [{ phaseName: ' ', orderIndex: 0 }, { phaseName: 'In thử', orderIndex: -1 }, { phaseName: 'In thử', orderIndex: 0, status: 'ACTIVE' }]) {
      await expect(createPhase('12', body)).rejects.toBeInstanceOf(Error);
    }
    expect(state.insert).not.toHaveBeenCalled();
  });
  it('does not write when project authorization denies access', async () => {
    state.authorize.mockRejectedValue(new Error('permission denied'));
    await expect(createPhase('12', { phaseName: 'In thử', orderIndex: 0 })).rejects.toThrow('permission denied');
    expect(state.insert).not.toHaveBeenCalled();
  });
  it('reports database failure without claiming successful creation', async () => {
    state.single.mockResolvedValue({ data: null, error: { code: '23502' } });
    await expect(createPhase('12', { phaseName: 'In thử', orderIndex: 0 })).rejects.toThrow('Không thể lưu giai đoạn.');
  });
});
