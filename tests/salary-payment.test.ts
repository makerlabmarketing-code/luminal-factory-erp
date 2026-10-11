import { describe, expect, it } from 'vitest';
import { isSalaryLedger, normalizeSalaryMonth } from '../lib/salary-payment';

describe('salary payment boundary', () => {
  it('classifies legacy salary expense rows and structured salary sources, excluding counter entries and reimbursements', () => {
    expect(isSalaryLedger({ type: 'CHI_TIEU', category: 'Lương T.6 - Nhân sự' })).toBe(true);
    expect(isSalaryLedger({ type: 'CHI_PHI', category: 'Khoản chi', source_type: 'PAYROLL' })).toBe(true);
    for (const type of ['VON_GOP', 'HOAN_UNG', 'DOANH_THU']) expect(isSalaryLedger({ type, category: 'Lương T.6' })).toBe(false);
    expect(isSalaryLedger({ type: 'CHI_PHI', category: 'Thanh toán lương nhiều nhân sự' })).toBe(false);
  });
  it('requires the explicitly confirmed salary month instead of guessing from the ledger period', () => {
    expect(normalizeSalaryMonth('06/2026')).toBe('2026-06-01');
    for (const value of ['6/2026', '13/2026', '2026-06', '', null, 6]) expect(normalizeSalaryMonth(value)).toBeNull();
  });
});
