import {
  buildAdminDashboardDto,
  type AdminDashboardDto,
  type DashboardLedgerEntry,
} from './adminDashboardDto';

export class DashboardDataError extends Error {
  failureStage: DashboardDataFailureStage;
  serviceName: string;
  supabaseErrorCode: string | null;

  constructor({
    message,
    failureStage,
    serviceName,
    supabaseErrorCode,
  }: {
    message: string;
    failureStage: DashboardDataFailureStage;
    serviceName: string;
    supabaseErrorCode?: string | null;
  }) {
    super(message);
    this.name = 'DashboardDataError';
    this.failureStage = failureStage;
    this.serviceName = serviceName;
    this.supabaseErrorCode = supabaseErrorCode ?? null;
  }
}

export type DashboardDataFailureStage = 'admin_authorization' | 'financial_ledger_select';

interface DashboardSupabaseError {
  code?: string;
}

interface DashboardLedgerQueryResult {
  data: DashboardLedgerEntry[] | null;
  error: DashboardSupabaseError | null;
}

interface DashboardLedgerQueryBuilder {
  select(columns: string): {
    eq(column: 'is_paid', value: true): Promise<DashboardLedgerQueryResult>;
  };
}

export interface DashboardSupabaseClient {
  from(table: 'financial_ledger'): DashboardLedgerQueryBuilder;
}

export interface AdminDashboardDataDependencies {
  requireAdmin: () => Promise<unknown>;
  createDashboardClient: () => Promise<DashboardSupabaseClient>;
  now: () => Date;
}

export const DASHBOARD_LEDGER_SELECT =
  'id, type, category, amount, is_paid, month_period, created_at, cancelled_at';

export async function getAdminDashboardDtoWithDependencies({
  requireAdmin,
  createDashboardClient,
  now,
}: AdminDashboardDataDependencies): Promise<AdminDashboardDto> {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof Error) throw error;

    throw new DashboardDataError({
      message: 'Không thể xác minh quyền quản trị.',
      failureStage: 'admin_authorization',
      serviceName: 'admin_dashboard',
    });
  }

  const supabase = await createDashboardClient();
  const { data: ledger, error } = await supabase
    .from('financial_ledger')
    .select(DASHBOARD_LEDGER_SELECT)
    .eq('is_paid', true);

  if (error) {
    throw new DashboardDataError({
      message: 'Không tải được dữ liệu dashboard.',
      failureStage: 'financial_ledger_select',
      serviceName: 'financial_ledger',
      supabaseErrorCode: error.code ?? 'unknown',
    });
  }

  if (!ledger) {
    throw new DashboardDataError({
      message: 'Không tải được dữ liệu dashboard.',
      failureStage: 'financial_ledger_select',
      serviceName: 'financial_ledger',
      supabaseErrorCode: 'empty_response',
    });
  }

  return buildAdminDashboardDto(ledger, now());
}
