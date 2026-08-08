import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const routeSource = readFileSync('app/api/admin/finance/ledger/[ledgerId]/route.ts', 'utf8');
const serviceSource = readFileSync('services/server/adminFinancialLedgerAtomic.ts', 'utf8');
const migrationSource = readFileSync('supabase/migrations/20260809004500_finance_linked_ledger_atomic_edit.sql', 'utf8');

describe('finance linked-ledger atomic edit boundary', () => {
  it('routes PUT updates through the atomic-aware server boundary', () => {
    expect(routeSource).toContain('updateAdminFinancialLedgerAtomicAware');
    expect(routeSource).not.toContain('updateAdminFinancialLedger(id(params.ledgerId)');
  });

  it('keeps authorization server-owned before using the admin RPC client', () => {
    expect(serviceSource).toContain("requireWorkspaceAccess('ADMIN_WORKSPACE'");
    expect(serviceSource).toContain("hasPermission(auth, 'FINANCE_UPDATE')");
    expect(serviceSource).toContain("admin.rpc('update_linked_financial_ledger_entry'");
  });

  it('falls back to the existing update path when no linked mutation is needed', () => {
    expect(serviceSource).toContain('ledgerUpdateRequiresAtomicLink');
    expect(serviceSource).toContain('return updateAdminFinancialLedger(ledgerId, body)');
  });

  it('keeps the RPC unavailable to browser roles', () => {
    expect(migrationSource).toContain('security invoker');
    expect(migrationSource).toContain('from public, anon, authenticated');
    expect(migrationSource).toContain('to service_role');
  });

  it('fails closed for ambiguous legacy links and conflicting target links', () => {
    expect(migrationSource).toContain("errcode = '21000'");
    expect(migrationSource).toContain("errcode = '23505'");
    expect(migrationSource).toContain('v_target_conflicts > 0');
  });

  it('updates primary and counter rows inside one postgres function transaction', () => {
    expect(migrationSource).toContain('update public.financial_ledger');
    expect(migrationSource).toContain("if v_action = 'CREATE'");
    expect(migrationSource).toContain("elsif v_action = 'UPDATE'");
    expect(migrationSource).toContain("elsif v_action = 'CANCEL'");
  });
});
