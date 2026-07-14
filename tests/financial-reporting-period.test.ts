import { describe, expect, it } from 'vitest';
import type { FinancialLedgerEntry } from '../lib/types/finance';
import {
  filterLedgerByReportingPeriod,
  groupPaidLedgerCashflowByReportingPeriod,
  isValidReportingPeriod,
  monthInputFromReportingPeriod,
  reportingPeriodFromMonthInput,
  summarizeFinancialLedger,
} from '../services/financialReportingService';

const marchBackfilledInJune: FinancialLedgerEntry = {
  id: 1,
  type: 'CHI_PHI',
  category: 'Mua vật tư tháng 3',
  amount: 100000,
  requested_by: 'Admin',
  is_paid: true,
  month_period: '03/2026',
  created_at: '2026-06-03T07:59:23.352836+00:00',
};

const juneTransaction: FinancialLedgerEntry = {
  id: 2,
  type: 'DOANH_THU',
  category: 'Doanh thu tháng 6',
  amount: 300000,
  requested_by: 'Admin',
  is_paid: true,
  month_period: '06/2026',
  created_at: '2026-06-03T08:00:00.000000+00:00',
};

describe('financial reporting period', () => {
  it('uses month_period, not created_at, for reporting period filters', () => {
    const ledger = [marchBackfilledInJune, juneTransaction];

    expect(filterLedgerByReportingPeriod(ledger, '03/2026')).toEqual([marchBackfilledInJune]);
    expect(filterLedgerByReportingPeriod(ledger, '06/2026')).toEqual([juneTransaction]);
  });

  it('keeps dashboard and ledger summaries on the same period source of truth', () => {
    const ledger = [
      marchBackfilledInJune,
      { ...marchBackfilledInJune, id: 3, type: 'VON_GOP', amount: 250000 },
      juneTransaction,
    ];

    const marchLedgerSummary = summarizeFinancialLedger(
      filterLedgerByReportingPeriod(ledger, '03/2026'),
    );
    const dashboardMarchSummary = groupPaidLedgerCashflowByReportingPeriod(ledger).find(
      (summary) => summary.name === '03/2026',
    );

    expect(marchLedgerSummary.capital).toBe(250000);
    expect(marchLedgerSummary.expense).toBe(100000);
    expect(dashboardMarchSummary).toEqual({ name: '03/2026', thu: 250000, chi: 100000 });
  });

  it('does not mutate created_at when preparing edited ledger values', () => {
    const editedPayload = {
      type: 'CHI_PHI',
      category: 'Mua vật tư tháng 3 đã sửa',
      amount: 120000,
      requested_by: 'Admin',
      month_period: '03/2026',
      is_paid: true,
    };

    expect(Object.keys(editedPayload)).not.toContain('created_at');
  });

  it('validates reporting period boundaries without timezone drift', () => {
    expect(reportingPeriodFromMonthInput('2026-03')).toBe('03/2026');
    expect(reportingPeriodFromMonthInput('2026-06')).toBe('06/2026');
    expect(monthInputFromReportingPeriod('03/2026')).toBe('2026-03');
    expect(isValidReportingPeriod('00/2026')).toBe(false);
    expect(isValidReportingPeriod('13/2026')).toBe(false);
  });
});
