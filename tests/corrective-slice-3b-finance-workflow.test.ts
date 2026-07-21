import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import {
  MISSING_EMPLOYEE_PAYMENT_INFO_MESSAGE,
  buildBeneficiaryVietQrUrl,
  canTransitionReimbursement,
  validateFinanceAttachment,
  validateFinanceRoleDraft,
  visibleFinanceRoleFields,
} from '../lib/financeExpenseWorkflow';

function source(path: string) {
  return fs.readFileSync(path, 'utf8');
}

describe('corrective slice 3B finance role model', () => {
  it('keeps salary beneficiary, payer and creator as separate roles', () => {
    const result = validateFinanceRoleDraft({
      category: 'salary',
      beneficiaryEmployeeId: 101,
      payerEmployeeId: 202,
      clientCreatorEmployeeId: 303,
    });

    expect(result.ok).toBe(true);
    expect(result.sanitizedDraft).toEqual({
      category: 'salary',
      beneficiaryEmployeeId: 101,
      payerEmployeeId: 202,
    });
    expect(result.sanitizedDraft).not.toHaveProperty('clientCreatorEmployeeId');
    expect(visibleFinanceRoleFields('salary')).toEqual(
      expect.arrayContaining(['beneficiary', 'payer', 'creator', 'approver', 'paymentConfirmer'])
    );
  });

  it('generates salary QR from beneficiary payment information and warns when missing', () => {
    const qr = buildBeneficiaryVietQrUrl({
      beneficiary: {
        employeeId: 'beneficiary-1',
        fullName: 'Hải Vân',
        bankName: 'MB',
        bankAccountNumber: '123456',
      },
      amount: 15000000,
      note: 'Lương tháng 07/2026',
    });

    expect(qr.ok).toBe(true);
    if (qr.ok) {
      expect(qr.url).toContain('MB-123456');
      expect(qr.url).toContain('amount=15000000');
      expect(qr.url).toContain(encodeURIComponent('Lương tháng 07/2026'));
    }

    expect(buildBeneficiaryVietQrUrl({ beneficiary: null, amount: 1, note: 'test' })).toEqual({
      ok: false,
      message: MISSING_EMPLOYEE_PAYMENT_INFO_MESSAGE,
    });
  });

  it('persists reimbursement requester and recipient separately in validation contract', () => {
    const result = validateFinanceRoleDraft({
      category: 'reimbursement',
      requesterEmployeeId: 'requester',
      reimbursementRecipientEmployeeId: 'recipient',
      beneficiaryEmployeeId: 'recipient',
      payerEmployeeId: 'finance-payer',
    });

    expect(result.ok).toBe(true);
    expect(result.sanitizedDraft.requesterEmployeeId).toBe('requester');
    expect(result.sanitizedDraft.reimbursementRecipientEmployeeId).toBe('recipient');
    expect(visibleFinanceRoleFields('reimbursement')).toEqual(
      expect.arrayContaining(['requester', 'reimbursementRecipient', 'approver', 'paymentConfirmer'])
    );
  });

  it('allows supplier beneficiary without forcing employee id', () => {
    expect(validateFinanceRoleDraft({ category: 'supplier_payment', beneficiaryExternalName: 'Nhà cung cấp A' }).ok).toBe(true);
    expect(validateFinanceRoleDraft({ category: 'supplier_payment' }).fieldErrors).toHaveProperty('beneficiaryExternalName');
  });

  it('validates reimbursement transitions, approval permissions, self-approval and rejection reason', () => {
    expect(canTransitionReimbursement({
      from: 'UNDER_REVIEW',
      to: 'REJECTED',
      actorEmployeeId: 2,
      requesterEmployeeId: 1,
      hasFinancePermission: false,
      hasReviewPermission: true,
    })).toEqual({ ok: false, message: 'Từ chối yêu cầu cần có lý do.' });

    expect(canTransitionReimbursement({
      from: 'UNDER_REVIEW',
      to: 'APPROVED',
      actorEmployeeId: 1,
      requesterEmployeeId: 1,
      hasFinancePermission: true,
      hasReviewPermission: true,
    })).toEqual({ ok: false, message: 'Nhân sự không được tự duyệt hoặc tự xác nhận đã thanh toán.' });

    expect(canTransitionReimbursement({
      from: 'APPROVED',
      to: 'PAID',
      actorEmployeeId: 2,
      requesterEmployeeId: 1,
      hasFinancePermission: true,
      hasReviewPermission: false,
    })).toEqual({ ok: true });
  });

  it('validates receipt file type, size and filename safety', () => {
    expect(validateFinanceAttachment({ name: 'receipt.pdf', type: 'application/pdf', size: 1024 })).toBeNull();
    expect(validateFinanceAttachment({ name: 'receipt.exe', type: 'application/octet-stream', size: 1024 })).toBe(
      'Chứng từ chỉ hỗ trợ JPG, PNG, WEBP hoặc PDF.'
    );
    expect(validateFinanceAttachment({ name: '../receipt.pdf', type: 'application/pdf', size: 1024 })).toBe(
      'Tên tệp chứng từ không hợp lệ.'
    );
    expect(validateFinanceAttachment({ name: 'receipt.pdf', type: 'application/pdf', size: 11 * 1024 * 1024 })).toBe(
      'Chứng từ không được vượt quá 10 MB.'
    );
  });

  it('redesigns the dialog with Vietnamese finance role sections and beneficiary QR copy', () => {
    const page = source('app/admin/capital/page.tsx');

    expect(page).toMatch(/Thông tin khoản chi/);
    expect(page).toMatch(/Người liên quan/);
    expect(page).toMatch(/Thanh toán/);
    expect(page).toMatch(/Chứng từ/);
    expect(page).toMatch(/Phê duyệt và lịch sử/);
    expect(page).toMatch(/Người hưởng lợi/);
    expect(page).toMatch(/Người thực hiện chi/);
    expect(page).toMatch(/Người tạo phiếu/);
    expect(page).toMatch(/MISSING_EMPLOYEE_PAYMENT_INFO_MESSAGE/);
    expect(page).not.toMatch(/Nhân sự thực hiện/);
  });
});
