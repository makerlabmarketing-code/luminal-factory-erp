export interface FinancialLedgerEntry {
  id: number | string;
  type?: string | null;
  sub_type?: string | null;
  category?: string | null;
  amount?: number | string | null;
  bill_url?: string | null;
  requested_by?: string | null;
  is_paid?: boolean | null;
  month_period?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}
