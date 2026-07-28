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
  transaction_date?: string | null;
  description?: string | null;
  project_id?: number | string | null;
  beneficiary_employee_id?: number | string | null;
  beneficiary_name?: string | null;
  beneficiary_external_name?: string | null;
  payer_employee_id?: number | string | null;
  payer_name?: string | null;
  reimbursement_status?: import('../financeExpenseWorkflow').ReimbursementRequestStatus | null;
  rejection_reason?: string | null;
  source_type?: string | null;
  source_reference?: string | null;
  attachments?: FinanceAttachment[];
}

export interface FinanceAttachment {
  id: number | string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  signedUrl?: string | null;
  legacyUrl?: string | null;
}

export type ExpensePaymentSourceKind = 'COMMON_FUND' | 'SHAREHOLDER';

export interface ExpensePaymentSourceOption {
  id: string;
  label: string;
  kind: ExpensePaymentSourceKind;
  reporterName: string | null;
  isActive: boolean;
}
