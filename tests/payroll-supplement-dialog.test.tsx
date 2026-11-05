import React, { type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
vi.mock('../app/admin/projects/[projectId]/ProjectActionDialog', () => ({ ProjectActionDialog: ({ children }: { children: ReactNode }) => <section>{children}</section> }));
vi.mock('@/lib/payroll-input', () => import('../lib/payroll-input'));
import { PayrollActionDialog } from '../app/admin/payroll/PayrollActionDialog';
import type { PayrollMonthDTO } from '../services/server/payroll';

const row: PayrollMonthDTO = { employeeId: '1', employeeName: 'Fixture', payrollMonth: '2026-10', workedMinutes: 4320, workedHours: 72, calculatedShifts: 24, hourlyRate: 30000, baseSalary: 2160000, settlementStatus: 'SETTLED', settlementId: '11111111-1111-4111-8111-111111111111', settledAt: '2026-11-05', approvedAdjustments: [], adjustmentTotal: 0, finalPayableAmount: 2160000, ledger: { id: '42', status: 'PAID' } };
function render(action: 'supplement' | 'adjust' | 'reopen') { return renderToStaticMarkup(<PayrollActionDialog row={row} action={action} onClose={() => {}} onBusy={() => {}} onSaved={async () => {}} />); }
describe('payroll lifecycle dialogs', () => {
  it('makes a paid-base addition an explicit separate unpaid obligation', () => {
    const html = render('supplement');
    expect(html).toContain('Tạo phiếu lương bổ sung'); expect(html).toContain('chỉ bằng số tiền cộng thêm');
    expect(html).toContain('không tự thanh toán hoặc gửi email'); expect(html).not.toContain('Thực nhận sau điều chỉnh');
  });
  it('explains that unpaid adjustment updates the pending obligation', () => {
    expect(render('adjust')).toContain('cập nhật số tiền trên phiếu đang chờ trả');
  });
  it('explains that reopening supersedes rather than erases history', () => {
    const html = render('reopen'); expect(html).toContain('hủy hiệu lực, giữ trong lịch sử'); expect(html).toContain('Chốt lại tạo phiếu mới');
  });
});
