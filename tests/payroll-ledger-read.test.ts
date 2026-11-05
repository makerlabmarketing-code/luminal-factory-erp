import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fixture = vi.hoisted(() => ({ finance: true, ledger: [] as Record<string, unknown>[], ledgerError: false, from: vi.fn() }));
const snapshot = '11111111-1111-4111-8111-111111111111';
vi.mock('server-only', () => ({}));
vi.mock('@/lib/payroll-input', () => import('../lib/payroll-input'));
vi.mock('../services/server/auth', () => ({
  AuthFlowError: class extends Error {},
  requireWorkspaceAccess: async () => ({ employee: { id: 3 } }),
  hasPermission: async (_auth: unknown, permission: string) => permission !== 'FINANCE_VIEW' || fixture.finance,
}));
vi.mock('@/utils/supabase/server', () => ({ createClient: async () => ({ rpc: async () => ({ data: [{ employee_id: 1, employee_name: 'Fixture', payroll_month: '2026-10-01', settlement_id: '11111111-1111-4111-8111-111111111111', final_payable_amount: 300 }], error: null }) }) }));
vi.mock('@/utils/supabase/admin', () => ({ createSupabaseAdminClient: () => ({ from: fixture.from }) }));
import { getAdminPayroll } from '../services/server/payroll';

const prior = [process.env.PAYROLL_SETTLEMENT_ENABLED, process.env.PAYROLL_REOPEN_ENABLED];
beforeEach(() => {
  fixture.finance = true; fixture.ledger = []; fixture.ledgerError = false;
  fixture.from.mockReset();
  fixture.from.mockImplementation((table: string) => {
    const result = () => ({ data: table === 'payroll_settlements' ? [{ id: snapshot, employees: { full_name: 'Reviewer' } }] : fixture.ledger, error: table === 'financial_ledger' && fixture.ledgerError ? { message: 'fixture failure' } : null });
    const query = {
      select: () => query, eq: () => query, in: () => query, is: () => query,
      maybeSingle: async () => ({ data: { first_settlement_month: '2026-09-01' }, error: null }),
      then: (resolve: (value: ReturnType<typeof result>) => unknown) => Promise.resolve(result()).then(resolve),
    };
    return query;
  });
  process.env.PAYROLL_SETTLEMENT_ENABLED = 'true'; process.env.PAYROLL_REOPEN_ENABLED = 'false';
});
afterEach(() => {
  ['PAYROLL_SETTLEMENT_ENABLED', 'PAYROLL_REOPEN_ENABLED'].forEach((key, index) => { if (prior[index] === undefined) delete process.env[key]; else process.env[key] = prior[index]; });
});
describe('payroll linked obligation visibility', () => {
  it('does not query or expose finance data to payroll-only viewers', async () => {
    fixture.finance = false;
    expect((await getAdminPayroll('2026-10')).payroll[0].ledger).toBeUndefined();
    expect(fixture.from).not.toHaveBeenCalledWith('financial_ledger');
  });
  it('reports an unlinked settled snapshot without inventing a payable', async () => {
    expect((await getAdminPayroll('2026-10')).payroll[0].ledger).toBeNull();
  });
  it.each([[300, false, 'UNPAID'], [300, true, 'PAID'], [0, false, 'ZERO']])('shows the authoritative source row status for amount %s and paid %s', async (amount, paid, status) => {
    fixture.ledger = [{ id: 42, type: 'CHI_PHI', source_type: 'PAYROLL', source_reference: snapshot, idempotency_key: `payroll-ledger:${snapshot}`, amount, is_paid: paid }];
    expect((await getAdminPayroll('2026-10')).payroll[0].ledger).toEqual({ id: '42', status });
  });
  it('does not mistake legacy/manual source rows for a linked obligation', async () => {
    fixture.ledger = [{ id: 42, type: 'CHI_PHI', source_type: 'PAYROLL', source_reference: snapshot, amount: 300 }];
    expect((await getAdminPayroll('2026-10')).payroll[0].ledger).toBeNull();
  });
  it('reports a read failure instead of silently presenting a missing or paid row', async () => {
    fixture.ledgerError = true;
    await expect(getAdminPayroll('2026-10')).rejects.toThrow('Không thể đối soát');
  });
});
