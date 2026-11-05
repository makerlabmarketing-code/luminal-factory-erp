import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fixture = vi.hoisted(() => ({ permission: vi.fn(), rpc: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/payroll-input', () => import('../lib/payroll-input'));
vi.mock('../services/server/auth', () => ({
  AuthFlowError: class extends Error { status: number; constructor(input: { message: string; status: number }) { super(input.message); this.status = input.status; } },
  requireWorkspaceAccess: async () => ({ employee: { id: 3 } }), hasPermission: fixture.permission,
}));
vi.mock('@/utils/supabase/server', () => ({ createClient: async () => ({ rpc: fixture.rpc }) }));
vi.mock('@/utils/supabase/admin', () => ({ createSupabaseAdminClient: vi.fn() }));
import { addPayrollSupplement } from '../services/server/payroll';

const snapshot = '11111111-1111-4111-8111-111111111111';
const request = '22222222-2222-4222-8222-222222222222';
const prior = process.env.PAYROLL_SETTLEMENT_ENABLED;
beforeEach(() => { vi.resetAllMocks(); fixture.permission.mockResolvedValue(true); fixture.rpc.mockResolvedValue({ data: 42, error: null }); process.env.PAYROLL_SETTLEMENT_ENABLED = 'true'; });
afterEach(() => { if (prior === undefined) delete process.env.PAYROLL_SETTLEMENT_ENABLED; else process.env.PAYROLL_SETTLEMENT_ENABLED = prior; });

describe('paid payroll supplement boundary', () => {
  it('sends only the explicit delta and stable request identity, with actor derived in SQL', async () => {
    await expect(addPayrollSupplement(snapshot, '100000', '  Khoản cộng thêm  ', request)).resolves.toEqual({ success: true, ledgerId: '42' });
    expect(fixture.rpc).toHaveBeenCalledWith('create_payroll_supplement', { p_settlement_id: snapshot, p_amount: 100000, p_reason: 'Khoản cộng thêm', p_request_id: request });
  });
  it.each([0, -1, 1.5, 'NaN', 'Infinity', 1000000000000])('rejects invalid or nonpositive delta %s before persistence', async amount => {
    await expect(addPayrollSupplement(snapshot, amount, 'Khoản cộng thêm', request)).rejects.toMatchObject({ status: 400 });
    expect(fixture.rpc).not.toHaveBeenCalled();
  });
  it('rejects missing permission without entering the RPC', async () => {
    fixture.permission.mockResolvedValue(false);
    await expect(addPayrollSupplement(snapshot, 100, 'Khoản cộng thêm', request)).rejects.toMatchObject({ status: 403 });
    expect(fixture.rpc).not.toHaveBeenCalled();
  });
  it('requires a stable valid request ID rather than inventing one on each retry', async () => {
    await expect(addPayrollSupplement(snapshot, 100, 'Khoản cộng thêm', null)).rejects.toMatchObject({ status: 400 });
    expect(fixture.rpc).not.toHaveBeenCalled();
  });
  it('reports missing schema safely instead of falling back to manual finance writes', async () => {
    fixture.rpc.mockResolvedValue({ error: { code: '42883', message: 'private database details' } });
    await expect(addPayrollSupplement(snapshot, 100, 'Khoản cộng thêm', request)).rejects.toMatchObject({ status: 503, message: 'Phiếu lương bổ sung đang chờ cập nhật dữ liệu.' });
    expect(fixture.rpc).toHaveBeenCalledTimes(1);
  });
});
