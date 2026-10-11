import type { FinancialLedgerEntry } from './types/finance';

export type SalaryEmailStatus = 'PENDING' | 'BLOCKED' | 'SENDING' | 'ACCEPTED' | 'UNKNOWN';
export function isSalaryLedger(row: Pick<FinancialLedgerEntry, 'type' | 'category' | 'source_type'>): boolean {
  return ['CHI_TIEU', 'CHI_PHI'].includes(row.type || '')
    && (['SALARY', 'PAYROLL'].includes(row.source_type || '') || /^Lương(?:\s|$)/iu.test(row.category || ''));
}
export function normalizeSalaryMonth(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const match = /^(0[1-9]|1[0-2])\/(\d{4})$/.exec(value.trim());
  return match ? `${match[2]}-${match[1]}-01` : null;
}
export const SALARY_EMAIL_LABELS: Record<SalaryEmailStatus, string> = {
  PENDING: 'Chờ gửi email', BLOCKED: 'Email chưa gửi', SENDING: 'Đang xử lý email',
  ACCEPTED: 'Dịch vụ email đã nhận', UNKNOWN: 'Cần kiểm tra kết quả gửi',
};
