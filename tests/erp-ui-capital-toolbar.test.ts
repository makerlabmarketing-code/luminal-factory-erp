import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
const source = (path: string) => readFileSync(path, 'utf8');
describe('ERP finance UI selection and shared component QA', () => {
  it('moves actions above data and selects current-page rows', () => {
    const ledger = source('app/admin/capital/components/LedgerTable.tsx');
    const page = source('app/admin/capital/page.tsx');
    expect(ledger.indexOf('aria-label="Công cụ giao dịch đã chọn"')).toBeLessThan(ledger.indexOf('<tbody>'));
    expect(ledger.slice(ledger.indexOf('data.map((l) => {'))).not.toContain('<TableRowActions');
    expect(ledger).toContain('aria-label="Chọn tất cả giao dịch trên trang"');
    expect(ledger).toContain('selectedRows.length === 1 ? renderSelectedRowActions(selectedRows[0])');
    expect(ledger).toContain('selectedRows.length > 1');
    expect(ledger).toContain('data.map(row => String(row.id))');
    expect(page).toContain('key={');
    expect(page).toContain('showDeleted}:' + '$' + '{searchTerm}:' + '$' + '{currentPage}');
  });
  it('preserves permissions and independent financial actions', () => {
    const ledger = source('app/admin/capital/components/LedgerTable.tsx');
    const actions = ledger.slice(ledger.indexOf('const renderSelectedRowActions'), ledger.indexOf('const getDisplayCategory'));
    for (const action of ['canTogglePaid', 'onTransitionReimbursement', 'onRetrySalaryEmail', 'onChangeSource', 'onTestArchive', 'onHistory']) expect(actions).toContain(action);
  });
  it('retains semantic tables, accessible menu and focus-managed panel', () => {
    const table = source('component/data-table/CommonTable.tsx');
    const panel = source('component/AdminSidePanel.tsx');
    expect(table).toContain('erp-common-table');
    expect(table).toContain('aria-label="Thao tác khác"');
    expect(panel).toContain('role="dialog"');
    expect(panel).toContain('aria-modal="true"');
    expect(panel).toContain('containModalFocus');
  });
});
