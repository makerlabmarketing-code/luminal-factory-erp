import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import fs from 'node:fs';
import { buildAdminDashboardDto, type DashboardLedgerEntry } from '../services/adminDashboardDto';
import {
  DASHBOARD_LEDGER_SELECT,
  DashboardDataError,
  getAdminDashboardDtoWithDependencies,
  type DashboardSupabaseClient,
} from '../services/adminDashboardDataCore';

const generatedAt = new Date('2026-07-14T00:00:00.000Z');

const marchBackfilledInJune: DashboardLedgerEntry = {
  id: 1,
  type: 'CHI_PHI',
  category: 'Mua vật tư tháng 3',
  amount: 100000,
  is_paid: true,
  month_period: '03/2026',
  created_at: '2026-06-20T08:00:00.000Z',
  cancelled_at: null,
};

const juneRevenue: DashboardLedgerEntry = {
  id: 2,
  type: 'DOANH_THU',
  category: 'Doanh thu tháng 6',
  amount: 300000,
  is_paid: true,
  month_period: '06/2026',
  created_at: '2026-06-25T08:00:00.000Z',
  cancelled_at: null,
};

const julyCapital: DashboardLedgerEntry = {
  id: 3,
  type: 'VON_GOP',
  category: 'Vốn góp tháng 7',
  amount: 250000,
  is_paid: true,
  month_period: '07/2026',
  created_at: '2026-07-02T08:00:00.000Z',
  cancelled_at: null,
};

function createDashboardClient({
  ledger,
  errorCode,
  queriedTables,
}: {
  ledger?: DashboardLedgerEntry[] | null;
  errorCode?: string;
  queriedTables: string[];
}): DashboardSupabaseClient {
  return {
    from(table) {
      queriedTables.push(table);
      return {
        select(columns: string) {
          expect(columns).toBe(DASHBOARD_LEDGER_SELECT);
          return {
            async eq(column, value) {
              expect(column).toBe('is_paid');
              expect(value).toBe(true);

              return {
                data: ledger ?? null,
                error: errorCode ? { code: errorCode } : null,
              };
            },
          };
        },
      };
    },
  };
}

describe('admin dashboard DTO', () => {
  it('retries dashboard data without a full-page navigation', () => {
    const source = fs.readFileSync('app/admin/dashboard/AdminDashboardCharts.tsx', 'utf8');

    expect(source).toMatch(/startTransition\(\(\) => router\.refresh\(\)\)/);
    expect(source).not.toMatch(/<a href="\/admin\/dashboard"/);
  });

  it('returns the minimal DTO for ADMIN ACTIVE data access', async () => {
    const queriedTables: string[] = [];

    const dto = await getAdminDashboardDtoWithDependencies({
      requireAdmin: async () => ({ role: 'ADMIN', status: 'ACTIVE' }),
      createDashboardClient: async () =>
        createDashboardClient({
          ledger: [marchBackfilledInJune, juneRevenue, julyCapital],
          queriedTables,
        }),
      now: () => generatedAt,
    });

    expect(queriedTables).toEqual(['financial_ledger']);
    expect(dto).toEqual({
      summary: {
        totalCapital: 250000,
        totalRevenue: 300000,
        totalExpense: 100000,
        currentBalance: 450000,
      },
      monthlyCashFlow: [
        { name: '06/2026', thu: 300000, chi: 100000 },
        { name: '07/2026', thu: 250000, chi: 0 },
      ],
      cashFlowComposition: [
        { name: 'Vốn Góp', value: 250000 },
        { name: 'Doanh Thu', value: 300000 },
        { name: 'Chi Phí', value: 100000 },
      ],
      reportingYear: '2026',
      generatedAt: '2026-07-14T00:00:00.000Z',
    });
  });

  it('uses the recorded month instead of the ledger business period for dashboard cashflow', () => {
    const dto = buildAdminDashboardDto([marchBackfilledInJune], generatedAt);

    expect(dto.monthlyCashFlow).toEqual([
      { name: '06/2026', thu: 0, chi: 100000 },
    ]);
    expect(dto.monthlyCashFlow.find((period) => period.name === '03/2026')).toBeUndefined();
  });

  it('uses the operating timezone when created_at crosses a UTC month boundary', () => {
    const dto = buildAdminDashboardDto([
      {
        ...juneRevenue,
        created_at: '2026-06-30T18:30:00.000Z',
      },
    ], generatedAt);

    expect(dto.monthlyCashFlow).toEqual([
      { name: '07/2026', thu: 300000, chi: 0 },
    ]);
  });

  it('keeps cancelled paid rows out of dashboard totals and charts', () => {
    const dto = buildAdminDashboardDto([
      julyCapital,
      {
        ...juneRevenue,
        cancelled_at: '2026-07-01T00:00:00.000Z',
      },
    ], generatedAt);

    expect(dto.summary).toEqual({
      totalCapital: 250000,
      totalRevenue: 0,
      totalExpense: 0,
      currentBalance: 250000,
    });
    expect(dto.monthlyCashFlow).toEqual([
      { name: '07/2026', thu: 250000, chi: 0 },
    ]);
    expect(dto.cashFlowComposition).toEqual([
      { name: 'Vốn Góp', value: 250000 },
    ]);
  });

  it('blocks a user without admin access before querying finance tables', async () => {
    const queriedTables: string[] = [];

    await expect(
      getAdminDashboardDtoWithDependencies({
        requireAdmin: async () => {
          throw new Error('admin_forbidden');
        },
        createDashboardClient: async () =>
          createDashboardClient({
            ledger: [marchBackfilledInJune],
            queriedTables,
          }),
        now: () => generatedAt,
      }),
    ).rejects.toThrow(/admin_forbidden/);

    expect(queriedTables).toEqual([]);
  });

  it('does not turn financial_ledger errors into zero dashboard data', async () => {
    const queriedTables: string[] = [];

    await expect(
      getAdminDashboardDtoWithDependencies({
        requireAdmin: async () => ({ role: 'ADMIN', status: 'ACTIVE' }),
        createDashboardClient: async () =>
          createDashboardClient({
            errorCode: '42501',
            queriedTables,
          }),
        now: () => generatedAt,
      }),
    ).rejects.toMatchObject({
      failureStage: 'financial_ledger_select',
      serviceName: 'financial_ledger',
      supabaseErrorCode: '42501',
    } satisfies Partial<DashboardDataError>);
  });

  it('does not query office_expenses or shareholders when the dashboard DTO does not need them', async () => {
    const queriedTables: string[] = [];

    await getAdminDashboardDtoWithDependencies({
      requireAdmin: async () => ({ role: 'ADMIN', status: 'ACTIVE' }),
      createDashboardClient: async () =>
        createDashboardClient({
          ledger: [marchBackfilledInJune],
          queriedTables,
        }),
      now: () => generatedAt,
    });

    expect(queriedTables).not.toContain('office_expenses');
    expect(queriedTables).not.toContain('shareholders');
  });

  it('keeps raw rows and sensitive columns out of the DTO contract', () => {
    const dto = buildAdminDashboardDto([
      {
        ...julyCapital,
        category: 'Tài khoản ngân hàng không được trả về DTO',
      },
    ], generatedAt);

    expect(JSON.stringify(dto)).not.toMatch(/category|requested_by|created_at|updated_at|bank|account/i);
  });

  it('renders true zero data as a successful zero-valued DTO', () => {
    const dto = buildAdminDashboardDto([], generatedAt);

    expect(dto.summary).toEqual({
      totalCapital: 0,
      totalRevenue: 0,
      totalExpense: 0,
      currentBalance: 0,
    });
    expect(dto.monthlyCashFlow).toEqual([]);
    expect(dto.cashFlowComposition).toEqual([]);
  });
});
