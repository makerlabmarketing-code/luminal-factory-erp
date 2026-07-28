import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { canTransitionReimbursement } from '../lib/financeExpenseWorkflow';
const read = (path: string) => readFileSync(path, 'utf8');
const migration = read('supabase/migrations/20260728153000_ledger_reimbursement_workflow.sql');
const server = read('services/server/financeReimbursements.ts');
const staff = read('app/staff/expenses/ExpensesView.tsx');

describe('approved ledger/reimbursement contract', () => {
  it('stores executor and employee/external beneficiary separately', () => {
    expect(migration).toMatch(/beneficiary_employee_id/);
    expect(migration).toMatch(/beneficiary_external_name/);
    expect(migration).toMatch(/payer_employee_id/);
    expect(migration).toMatch(/beneficiary_kind_check/);
  });
  it('resolves employee beneficiary and preserves unknown legacy display', () => {
    expect(migration).toMatch(/left join public\.employees b/);
    expect(migration).toContain("coalesce(b.full_name,fl.beneficiary_external_name,'Chưa xác định')");
    expect(staff).toContain("expense.beneficiary_name || 'Chưa xác định'");
    expect(migration).not.toMatch(/update public\.financial_ledger set beneficiary_employee_id/);
  });
  it('isolates employee reads and permits own submission only', () => {
    expect(migration).toMatch(/reimbursement_requester_employee_id=public\.current_employee_id\(\)/);
    expect(migration).toMatch(/beneficiary_employee_id=public\.current_employee_id\(\)/);
    expect(migration).toMatch(/beneficiary<>actor/);
    expect(server).toMatch(/requireWorkspaceAccess\('STAFF_WORKSPACE'\)/);
  });
  it('requires finance authority and prevents self approval', () => {
    expect(migration).toMatch(/public\.has_permission\(permission\)/);
    expect(migration).toMatch(/requester=actor/);
    expect(canTransitionReimbursement({ from: 'SUBMITTED', to: 'APPROVED', actorEmployeeId: 1, requesterEmployeeId: 1, hasApprovalPermission: true, hasPaymentConfirmationPermission: false, hasReviewPermission: true }).ok).toBe(false);
  });
  it('prevents employee edits after submission and every hard delete', () => {
    expect(migration).not.toMatch(/grant update on public\.financial_ledger to authenticated/);
    expect(migration).toMatch(/financial_ledger_no_delete/);
    expect(migration).toMatch(/finance_ledger_history_immutable/);
  });
  it('keeps audit actor and timestamps server-derived and immutable', () => {
    expect(migration).toMatch(/actor bigint:=public\.current_employee_id\(\)/);
    expect(migration).toMatch(/stamp timestamptz:=clock_timestamp\(\)/);
    expect(server).not.toMatch(/actorEmployeeId|occurredAt/);
  });
  it('renders existing attachments and sanitizes storage failures', () => {
    expect(staff).toMatch(/expense\.bill_url/);
    expect(server).not.toMatch(/error\.message/);
    expect(read('supabase/drafts/20260728153000_ledger_storage_policy.md')).toMatch(/signed URLs|signed URL/);
  });
  it('preserves payroll source identity without merging snapshots', () => {
    expect(migration).toMatch(/source_type/);
    expect(migration).toMatch(/source_reference/);
    expect(migration).toMatch(/source_identity_unique/);
    expect(migration).not.toMatch(/update public\.payroll_settlements/);
  });
  it('deduplicates submission and payment confirmation', () => {
    expect(migration).toMatch(/financial_ledger_idempotency_key_unique_idx/);
    expect(migration).toMatch(/idempotency_key text not null unique/);
    expect(staff).toMatch(/if \(isSubmitting\) return/);
  });
  it('uses only the six approved statuses', () => {
    expect(migration).toContain("'DRAFT','SUBMITTED','APPROVED','REJECTED','PAID','CANCELLED'");
    expect(migration).not.toContain('UNDER_REVIEW');
  });
});
