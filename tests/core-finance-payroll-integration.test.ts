import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ALL_PERMISSION_CODES, getPermissionPresentation } from '../lib/account-permissions';

const read = (path: string) => readFileSync(path, 'utf8');

describe('core finance and payroll integration', () => {
  it('makes every live finance and payroll permission configurable by an administrator', () => {
    expect(ALL_PERMISSION_CODES).toEqual(expect.arrayContaining([
      'FINANCE_APPROVE',
      'FINANCE_PAY',
      'PAYROLL_VIEW',
      'PAYROLL_SETTLE',
      'PAYROLL_ADJUST',
      'PAYROLL_CONFIGURE',
    ]));
    expect(getPermissionPresentation('PAYROLL_VIEW')).toMatchObject({ group: 'Bảng lương', label: 'Xem bảng lương' });
  });

  it('connects reimbursement status actions to the audited transition endpoint', () => {
    const page = read('app/admin/capital/page.tsx');
    const table = read('app/admin/capital/components/LedgerTable.tsx');
    const client = read('services/adminFinancialLedgerService.ts');
    expect(page).toContain('transitionAdminReimbursement');
    expect(table).toContain("onTransitionReimbursement(l, 'APPROVED')");
    expect(table).toContain("onTransitionReimbursement(l, 'REJECTED')");
    expect(table).toContain("onTransitionReimbursement(l, 'PAID')");
    expect(client).toContain("fetch('/api/admin/finance/reimbursements'");
  });

  it('does not let generic ledger edits bypass the reimbursement workflow', () => {
    const server = read('services/server/adminFinancialLedger.ts');
    expect(server).toContain("original.type === 'HOAN_UNG'");
    expect(server).toContain("target.type === 'HOAN_UNG'");
  });

  it('shows staff reimbursement load failures with a retry action', () => {
    const staff = read('app/staff/expenses/ExpensesView.tsx');
    expect(staff).toContain('setLoadError');
    expect(staff).toContain('void loadExpensesData()');
    expect(staff).toContain('Thử lại');
  });
});
