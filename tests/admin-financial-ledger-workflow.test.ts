import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  LedgerValidationError,
  financeAttachmentExtension,
  hasValidFinanceAttachmentSignature,
  ledgerUpdateRequiresAtomicLink,
  resolveLedgerPeople,
  validateAdminLedgerMutation,
} from '../lib/adminFinancialLedger';
import { validateFinanceAttachment } from '../lib/financeExpenseWorkflow';

const source = (path: string) => readFileSync(path, 'utf8');

describe('Admin financial ledger repair', () => {
  it('validates exact fields and keeps executor and beneficiary independent', () => {
    const valid = validateAdminLedgerMutation({
      type: 'CHI_PHI', category: 'Mua vật liệu', amount: 500000,
      monthPeriod: '06/2026', transactionDate: '2026-06-12',
      payerEmployeeId: 2, beneficiaryEmployeeId: 7, isPaid: false,
    });
    expect(valid.payerEmployeeId).toBe(2);
    expect(valid.beneficiaryEmployeeId).toBe(7);

    expect(() => validateAdminLedgerMutation({ type: 'CHI_PHI', category: '', amount: 0, monthPeriod: '2026-06' }))
      .toThrow(LedgerValidationError);
    try {
      validateAdminLedgerMutation({ type: 'CHI_PHI', category: '', amount: 0, monthPeriod: '2026-06' });
    } catch (error) {
      expect((error as LedgerValidationError).fieldErrors).toEqual(expect.objectContaining({ category: expect.any(String), amount: expect.any(String), monthPeriod: expect.any(String) }));
    }
  });

  it('never infers a legacy beneficiary from requested_by', () => {
    const legacy = resolveLedgerPeople({ id: 1, requested_by: 'Hà', category: 'Lương tháng 06' }, new Map());
    expect(legacy.payer_name).toBe('Hà');
    expect(legacy.beneficiary_name).toBe('Chưa xác định');

    const linked = resolveLedgerPeople({ id: 2, requested_by: 'Hà', beneficiary_employee_id: 7 }, new Map([['7', 'Lan']]));
    expect(linked.beneficiary_name).toBe('Lan');
  });

  it('uses safe stable attachment extensions', () => {
    expect(financeAttachmentExtension({ name: 'hoa-don.jpeg', type: 'image/jpeg' })).toBe('jpg');
    expect(financeAttachmentExtension({ name: 'phieu.pdf', type: 'application/pdf' })).toBe('pdf');
    expect(validateFinanceAttachment({ name: 'phieu.exe', type: 'application/pdf', size: 128 })).toMatch(/Phần mở rộng/);
    expect(validateFinanceAttachment({ name: 'phieu.pdf', type: 'application/pdf', size: 0 })).toMatch(/để trống/);
  });

  it('rejects spoofed attachment content and identifies linked edits that must fail closed', async () => {
    const file = (type: string, bytes: number[]) => ({
      type,
      arrayBuffer: async () => Uint8Array.from(bytes).buffer,
    });
    expect(await hasValidFinanceAttachmentSignature(file('application/pdf', [0x25, 0x50, 0x44, 0x46, 0x2d]))).toBe(true);
    expect(await hasValidFinanceAttachmentSignature(file('application/pdf', [0x3c, 0x68, 0x74, 0x6d, 0x6c]))).toBe(false);
    expect(ledgerUpdateRequiresAtomicLink({ hasExistingLink: true, type: 'CHI_PHI', expenseSourceId: 'QUY_CHUNG' })).toBe(true);
    expect(ledgerUpdateRequiresAtomicLink({ hasExistingLink: false, type: 'CHI_PHI', expenseSourceId: 'SHAREHOLDER:7' })).toBe(true);
    expect(ledgerUpdateRequiresAtomicLink({ hasExistingLink: false, type: 'DOANH_THU', expenseSourceId: null })).toBe(false);
  });

  it('moves every Admin write behind server authorization and preserves gated compatibility', () => {
    const page = source('app/admin/capital/page.tsx');
    const server = source('services/server/adminFinancialLedger.ts');
    const route = source('app/api/admin/finance/ledger/route.ts');

    expect(page).not.toMatch(/from\('financial_ledger'\)\.(insert|update|delete)/);
    expect(server).toMatch(/requireFinance\('FINANCE_CREATE'\)/);
    expect(server).toMatch(/requireFinance\('FINANCE_UPDATE'\)/);
    expect(server).toMatch(/requireFinance\('FINANCE_VIEW'\)/);
    expect(server).toMatch(/process\.env\.FINANCE_REIMBURSEMENT_ENABLED === 'true'/);
    expect(server).toMatch(/requireExtendedLedgerSchema/);
    expect(server).toMatch(/attachmentStorageReady/);
    expect(server).toMatch(/ledgerUpdateRequiresAtomicLink/);
    expect(route).toMatch(/createAdminFinancialLedger/);
  });

  it('does not overwrite creator or idempotency provenance during an edit', () => {
    const server = source('services/server/adminFinancialLedger.ts');
    const mutationBoundary = server.slice(server.indexOf('function mutationColumns'), server.indexOf('async function employeeName'));
    expect(mutationBoundary).toMatch(/mode === 'create'/);
    expect(mutationBoundary).toMatch(/creator_employee_id/);
    expect(mutationBoundary).toMatch(/idempotency_key/);
    expect(server).toMatch(/Giao dịch có dòng đối ứng chỉ được sửa sau khi xử lý nguyên tử được kích hoạt/);
  });

  it('uploads new objects before metadata replacement and archives before old-object cleanup', () => {
    const server = source('services/server/adminFinancialLedger.ts');
    const replaceBoundary = server.slice(server.indexOf('export async function replaceAdminLedgerAttachment'));
    expect(replaceBoundary.indexOf('storeAttachment')).toBeLessThan(replaceBoundary.indexOf("verification_state: 'REPLACED'"));
    expect(replaceBoundary.indexOf("verification_state: 'REPLACED'")).toBeLessThan(replaceBoundary.indexOf('.remove([old.storage_path])'));
    expect(server).toMatch(/verification_state: 'REMOVED'/);
    expect(server).toMatch(/await admin\.storage\.from\(FINANCE_EVIDENCE_BUCKET\)\.remove\(\[path\]\)/);
  });

  it('keeps private storage delivery draft-only with guarded rollback and read-only validation', () => {
    const forward = source('supabase/drafts/20260801_finance_evidence_storage_forward.sql');
    const rollback = source('supabase/drafts/20260801_finance_evidence_storage_rollback.sql');
    const validation = source('supabase/validation/20260801_finance_evidence_storage_validation.sql');
    expect(forward).toMatch(/'finance-evidence'[\s\S]*false[\s\S]*10485760/);
    expect(forward).not.toMatch(/create policy|to authenticated|to anon/);
    expect(rollback).toMatch(/if exists \(select 1 from storage\.objects/);
    expect(rollback).toMatch(/Rollback blocked/);
    expect(validation).toMatch(/public = false as private_bucket/);
    expect(validation).toMatch(/broad_policy_candidate/);
    expect(validation).toMatch(/reimbursement_attachment_table_ready/);
    expect(validation).not.toMatch(/\b(insert|update|delete|alter|create|drop)\b/i);
  });

  it('builds beneficiary QR from stable beneficiary id and keeps a synchronous submit lock', () => {
    const page = source('app/admin/capital/page.tsx');
    expect(page).toMatch(/String\(e\.id\) === String\(item\.beneficiary_employee_id\)/);
    expect(page).toMatch(/submitLock\.current = true/);
    expect(page).toMatch(/submitLock\.current = false/);
  });
});
