import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repositoryRoot = join(__dirname, '..');

function source(relativePath: string): string {
  return readFileSync(join(repositoryRoot, relativePath), 'utf8');
}

describe('expense payment source binding', () => {
  it('loads payment sources from live shareholders columns only', () => {
    const capitalPage = source('app/admin/capital/page.tsx');
    const shareholdersQuery = capitalPage.slice(
      capitalPage.indexOf(".from('shareholders')"),
      capitalPage.indexOf("if (paymentSourceError) throw paymentSourceError")
    );

    expect(shareholdersQuery).toMatch(/from\('shareholders'\)/);
    expect(shareholdersQuery).toMatch(/select\('id, name, status'\)/);
    expect(shareholdersQuery).not.toMatch(/shareholder_name|display_name|full_name/);
  });

  it('uses stable ids as option values and does not hardcode people', () => {
    const capitalPage = source('app/admin/capital/page.tsx');

    expect(capitalPage).toMatch(/SELF_PAID_SOURCE_PREFIX/);
    expect(capitalPage).toMatch(/id: `\$\{SELF_PAID_SOURCE_PREFIX\}\$\{row\.id\}`/);
    expect(capitalPage).toMatch(/value=\{source\.id\}/);
    expect(capitalPage).not.toMatch(/value=\{source\.label\}/);
  });

  it('renders loading, empty, and error states for the source select', () => {
    const capitalPage = source('app/admin/capital/page.tsx');

    expect(capitalPage).toMatch(/expenseSourcesLoading/);
    expect(capitalPage).toMatch(/expenseSourcesError/);
    expect(capitalPage).toMatch(/Đang tải nguồn chi trả/);
    expect(capitalPage).toMatch(/Chưa có nguồn chi trả hợp lệ/);
    expect(capitalPage).toMatch(/Không tải được nguồn chi trả/);
  });

  it('keeps create and edit expense source behavior on financial_ledger', () => {
    const capitalPage = source('app/admin/capital/page.tsx');
    const ledgerServer = source('services/server/adminFinancialLedger.ts');

    expect(ledgerServer).toMatch(/isSelfPaidExpense/);
    expect(ledgerServer).toMatch(/type: 'VON_GOP'/);
    expect(ledgerServer).toMatch(/requested_by: requestedBy/);
    expect(capitalPage).toMatch(/expenseSourceId: values\.expenseSource/);
    expect(ledgerServer).not.toMatch(/payment_source|payment_source_id|shareholder_id|source_id/);
  });

  it('does not report successful ledger edits or payments after a failed mutation', () => {
    const capitalPage = source('app/admin/capital/page.tsx');
    const editMutationBoundary = capitalPage.slice(
      capitalPage.indexOf('const handleSaveEdit'),
      capitalPage.indexOf('const handleTogglePaid')
    );
    const paymentMutationBoundary = capitalPage.slice(
      capitalPage.indexOf('const handleTogglePaid'),
      capitalPage.indexOf('const handleGenerateVietQR')
    );

    expect(editMutationBoundary).toMatch(/await updateAdminFinancialLedger\(editingId, input\)/);
    expect(editMutationBoundary).toMatch(/setEditError\(\{ message, correlationId \}\)/);
    expect(capitalPage).toMatch(/role="alert"[\s\S]*Mã hỗ trợ: \{editError\.correlationId\}/);
    expect(capitalPage).toMatch(/disabled=\{isSubmitting\}[\s\S]*Đang lưu/);
    expect(paymentMutationBoundary).toMatch(/await setAdminFinancialLedgerPaid/);
    expect(paymentMutationBoundary.match(/catch \(error\)/g)).toHaveLength(2);
  });
});
