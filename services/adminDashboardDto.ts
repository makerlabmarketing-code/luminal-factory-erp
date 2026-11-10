import { compareReportingPeriods, personalAdvanceExpenseIds } from './financialReportingService';
import type { MonthlyChartData } from '../lib/types/dashboard';

export interface DashboardSummaryDto {
  totalCapital: number;
  totalRevenue: number;
  totalExpense: number;
  currentBalance: number;
}

export interface DashboardCompositionDto {
  name: 'Vốn Góp' | 'Doanh Thu' | 'Chi Phí' | 'Hoàn Ứng';
  value: number;
}

export interface AdminDashboardDto {
  summary: DashboardSummaryDto;
  monthlyCashFlow: MonthlyChartData[];
  cashFlowComposition: DashboardCompositionDto[];
  reportingYear: string;
  generatedAt: string;
}

export interface DashboardLedgerEntry {
  id: number | string;
  type?: string | null;
  category?: string | null;
  amount?: number | string | null;
  is_paid?: boolean | null;
  month_period?: string | null;
  created_at?: string | null;
  cancelled_at?: string | null;
  source_type?: string | null;
  source_reference?: string | null;
}

const DASHBOARD_TIME_ZONE = 'Asia/Bangkok';

export function buildAdminDashboardDto(
  ledger: DashboardLedgerEntry[],
  generatedAt: Date = new Date(),
): AdminDashboardDto {
  const reportingYear = yearInDashboardTimeZone(generatedAt);
  let totalCapital = 0;
  let totalRevenue = 0;
  let totalExpense = 0;
  let totalRefund = 0;
  let yearCapital = 0;
  let yearRevenue = 0;
  let yearExpense = 0;
  let yearPersonalExpense = 0;
  let yearAdvanceRefund = 0;
  const personalExpenses = personalAdvanceExpenseIds(ledger);
  const groupedByPeriod: Record<string, MonthlyChartData> = {};

  ledger.forEach((entry) => {
    if (!entry.is_paid || entry.cancelled_at || entry.source_type === 'PERSONAL_ADVANCE') return;
    const isAdvanceRefund = entry.source_type === 'PERSONAL_ADVANCE_REFUND';
    const isPersonalExpense = personalExpenses.has(String(entry.id));

    const amount = Number(entry.amount) || 0;
    const recordedPeriod = reportingPeriodFromCreatedAt(entry.created_at);

    if (recordedPeriod) {
      if (!groupedByPeriod[recordedPeriod]) {
        groupedByPeriod[recordedPeriod] = { name: recordedPeriod, thu: 0, chi: 0 };
      }

      if (entry.type === 'VON_GOP' || entry.type === 'DOANH_THU') {
        groupedByPeriod[recordedPeriod].thu += amount;
      } else if (isDashboardExpenseType(entry.type) && !isPersonalExpense) {
        groupedByPeriod[recordedPeriod].chi += amount;
      }

      if (recordedPeriod.endsWith(`/${reportingYear}`)) {
        if (entry.type === 'VON_GOP') yearCapital += amount;
        else if (entry.type === 'DOANH_THU') yearRevenue += amount;
        else if (isAdvanceRefund) yearAdvanceRefund += amount;
        else if (isDashboardExpenseType(entry.type)) {
          yearExpense += amount;
          if (isPersonalExpense) yearPersonalExpense += amount;
        }
      }
    }

    if (entry.type === 'VON_GOP') totalCapital += amount;
    if (entry.type === 'DOANH_THU') totalRevenue += amount;
    if (!isAdvanceRefund && (entry.type === 'CHI_PHI' || entry.type === 'CHI_TIEU')) totalExpense += amount;
    if (entry.type === 'HOAN_UNG') totalRefund += amount;
  });

  const monthlyCashFlow = Object.values(groupedByPeriod).sort((a, b) =>
    compareReportingPeriods(a.name, b.name),
  );

  const allCashFlowComposition: DashboardCompositionDto[] = [
    { name: 'Vốn Góp', value: totalCapital },
    { name: 'Doanh Thu', value: totalRevenue },
    { name: 'Chi Phí', value: totalExpense },
    { name: 'Hoàn Ứng', value: totalRefund },
  ];
  const cashFlowComposition = allCashFlowComposition.filter((entry) => entry.value > 0);

  return {
    summary: {
      totalCapital: yearCapital,
      totalRevenue: yearRevenue,
      totalExpense: yearExpense,
      currentBalance: yearCapital + yearRevenue - yearExpense + yearPersonalExpense - yearAdvanceRefund,
    },
    monthlyCashFlow,
    cashFlowComposition,
    reportingYear,
    generatedAt: generatedAt.toISOString(),
  };
}

function reportingPeriodFromCreatedAt(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: DASHBOARD_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(date);
  const month = parts.find((part) => part.type === 'month')?.value;
  const year = parts.find((part) => part.type === 'year')?.value;

  return month && year ? `${month}/${year}` : null;
}

function yearInDashboardTimeZone(value: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: DASHBOARD_TIME_ZONE,
    year: 'numeric',
  }).format(value);
}

function isDashboardExpenseType(type: string | null | undefined): boolean {
  return type === 'CHI_PHI' || type === 'CHI_TIEU' || type === 'HOAN_UNG';
}
