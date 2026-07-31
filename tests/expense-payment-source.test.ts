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

    expect(capitalPage).toMatch(/isSelfPaidExpense/);
    expect(capitalPage).toMatch(/type: 'CHI_PHI'/);
    expect(capitalPage).toMatch(/type: 'VON_GOP'/);
    expect(capitalPage).toMatch(/requested_by: insertReporter/);
    expect(capitalPage).toMatch(/requested_by: editReporterName/);
    expect(capitalPage).not.toMatch(/payment_source|payment_source_id|shareholder_id|source_id/);
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

    expect(editMutationBoundary).toMatch(/if \(oldLinkError\) throw oldLinkError/);
    expect(editMutationBoundary).toMatch(/if \(primaryError\) throw primaryError/);
    expect(editMutationBoundary).toMatch(/if \(linkedError\) \{[\s\S]*error: rollbackError[\s\S]*throw linkedError/);
    expect(editMutationBoundary.indexOf('error: primaryError')).toBeLessThan(
      editMutationBoundary.indexOf('let linkedError')
    );
    expect(editMutationBoundary).toMatch(/setEditError\(\{ message, correlationId \}\)/);
    expect(capitalPage).toMatch(/role="alert"[\s\S]*Mã hỗ trợ: \{editError\.correlationId\}/);
    expect(capitalPage).toMatch(/disabled=\{isSubmitting\}[\s\S]*Đang lưu/);
    expect(paymentMutationBoundary).toMatch(/if \(error\) \{[\s\S]*Dữ liệu chưa được cập nhật/);
    expect(paymentMutationBoundary.match(/if \(error\) \{/g)).toHaveLength(2);
  });
});
