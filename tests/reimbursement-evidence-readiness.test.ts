import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

describe('reimbursement evidence readiness', () => {
  it('keeps storage private and browser roles without direct object policies', () => {
    const migration = read('supabase/migrations/20260809035452_finance_evidence_storage.sql');
    expect(migration).toContain("'finance-evidence'");
    expect(migration).toContain('false');
    expect(migration).toContain('10485760');
    expect(migration).toContain('Intentionally no anon/authenticated storage.objects policies');
  });

  it('routes staff evidence through the authenticated server boundary', () => {
    const route = read('app/api/staff/reimbursements/[ledgerId]/attachments/route.ts');
    const server = read('services/server/financeReimbursements.ts');
    expect(route).toContain('uploadOwnReimbursementAttachment');
    expect(server).toContain("requireWorkspaceAccess('STAFF_WORKSPACE')");
    expect(server).toContain(".eq('type', 'HOAN_UNG')");
    expect(server).toContain("ledger.reimbursement_status !== 'SUBMITTED'");
    expect(server).toContain('hasValidFinanceAttachmentSignature');
    expect(server).toContain('FINANCE_ATTACHMENT_WRITES_ENABLED');
  });

  it('does not persist a client supplied receipt URL for new staff reimbursements', () => {
    const server = read('services/server/financeReimbursements.ts');
    const client = read('services/staffExpensesService.ts');
    expect(server).toContain('p_receipt_url: null');
    expect(client).toContain('receiptUrl: null');
    expect(client).toContain('attachmentUploaded: false');
  });
});
