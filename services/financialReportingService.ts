import {
  businessMonthFromDateInput,
  formatBusinessMonthInput,
  formatBusinessMonthPeriod,
} from '../lib/business-date';
import type { BusinessMonth } from '../lib/business-date';
import type { FinancialLedgerEntry } from '../lib/types/finance';

export interface FinancialLedgerSummary {
  capital: number;
  cashCapital: number;
  inKindCapital: number;
  revenue: number;
  expense: number;
  pending: number;
  balance: number;
}

export interface MonthlyCashflowSummary {
  name: string;
  thu: number;
  chi: number;
}

const REPORTING_PERIOD_PATTERN = /^(0[1-9]|1[0-2])\/\d{4}$/;

export function reportingPeriodFromMonthInput(monthInput: string): string {
  return formatBusinessMonthPeriod(businessMonthFromDateInput(monthInput));
}

export function monthInputFromReportingPeriod(period: string | null | undefined): string {
  if (!period || !REPORTING_PERIOD_PATTERN.test(period)) return '';

  const [month, year] = period.split('/');
  return formatBusinessMonthInput({ year: Number(year), month: Number(month) });
}

export function isValidReportingPeriod(period: string | null | undefined): boolean {
  if (!period || !REPORTING_PERIOD_PATTERN.test(period)) return false;

  try {
    monthInputFromReportingPeriod(period);
    return true;
  } catch {
    return false;
  }
}

export function compareReportingPeriods(a: string, b: string): number {
  const monthA = parseReportingPeriod(a);
  const monthB = parseReportingPeriod(b);

  return monthA.year === monthB.year ? monthA.month - monthB.month : monthA.year - monthB.year;
}

export function filterLedgerByReportingPeriod(
  ledger: FinancialLedgerEntry[],
  reportingPeriod: string,
): FinancialLedgerEntry[] {
  return ledger.filter((entry) => entry.month_period === reportingPeriod);
}

export function summarizeFinancialLedger(ledger: FinancialLedgerEntry[]): FinancialLedgerSummary {
  const initial: FinancialLedgerSummary = {
    capital: 0,
    cashCapital: 0,
    inKindCapital: 0,
    revenue: 0,
    expense: 0,
    pending: 0,
    balance: 0,
  };

  const summary = ledger.reduce<FinancialLedgerSummary>((result, entry) => {
    const amount = ledgerAmount(entry);

    if (!entry.is_paid) {
      result.pending += amount;
      return result;
    }

    if (entry.type === 'VON_GOP') {
      result.capital += amount;
      if (entry.sub_type === 'HIEN_VAT') result.inKindCapital += amount;
      else result.cashCapital += amount;
    } else if (entry.type === 'DOANH_THU') {
      result.revenue += amount;
    } else if (isExpenseType(entry.type)) {
      result.expense += amount;
    }

    return result;
  }, initial);

  summary.balance = summary.capital + summary.revenue - summary.expense;
  return summary;
}

export function groupPaidLedgerCashflowByReportingPeriod(
  ledger: FinancialLedgerEntry[],
): MonthlyCashflowSummary[] {
  const groupedByPeriod: Record<string, MonthlyCashflowSummary> = {};

  ledger.forEach((entry) => {
    if (!entry.is_paid || !isValidReportingPeriod(entry.month_period)) return;

    const period = entry.month_period as string;
    const amount = ledgerAmount(entry);

    if (!groupedByPeriod[period]) {
      groupedByPeriod[period] = { name: period, thu: 0, chi: 0 };
    }

    if (entry.type === 'VON_GOP' || entry.type === 'DOANH_THU') {
      groupedByPeriod[period].thu += amount;
    } else if (isExpenseType(entry.type)) {
      groupedByPeriod[period].chi += amount;
    }
  });

  return Object.values(groupedByPeriod).sort((a, b) => compareReportingPeriods(a.name, b.name));
}

function parseReportingPeriod(period: string): BusinessMonth {
  if (!isValidReportingPeriod(period)) {
    throw new Error(`Invalid reporting period: ${period}`);
  }

  const [month, year] = period.split('/');
  return { year: Number(year), month: Number(month) };
}

function ledgerAmount(entry: FinancialLedgerEntry): number {
  return Number(entry.amount) || 0;
}

function isExpenseType(type: string | null | undefined): boolean {
  return type === 'CHI_PHI' || type === 'CHI_TIEU' || type === 'HOAN_UNG';
}
