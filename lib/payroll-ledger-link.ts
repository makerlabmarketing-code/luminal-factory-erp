import type { FinancialLedgerEntry } from './types/finance';

type PayrollSource = Pick<FinancialLedgerEntry, 'type' | 'source_type' | 'source_reference' | 'idempotency_key' | 'amount'>;

/** Reserved database-generated identity; legacy salary rows keep their existing flow. */
export function isLinkedPayrollLedger(row: PayrollSource): boolean {
  const reference = row.source_reference;
  const prefix = row.source_type === 'PAYROLL' ? 'payroll-ledger:' : row.source_type === 'PAYROLL_SUPPLEMENT' ? 'payroll-supplement:' : null;
  return row.type === 'CHI_PHI' && prefix !== null
    && typeof reference === 'string' && /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(reference)
    && row.idempotency_key === `${prefix}${reference}`;
}

export function isZeroPayrollObligation(row: PayrollSource): boolean {
  return isLinkedPayrollLedger(row) && row.amount != null && String(row.amount).trim() !== '' && Number(row.amount) === 0;
}
