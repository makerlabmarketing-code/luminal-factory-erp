import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(__dirname, '..');
const preflight = readFileSync(join(root, 'supabase/drafts/20260803_employee_create_schema_preflight.sql'), 'utf8');
const validation = readFileSync(join(root, 'supabase/validation/20260803_employee_create_schema_preflight_validation.sql'), 'utf8');
const contract = readFileSync(join(root, 'docs/employee-persistence-contract.md'), 'utf8');
const handoff = readFileSync(join(root, 'docs/current-operator-handoff.md'), 'utf8');
const roadmap = readFileSync(join(root, 'docs/ERP_IMPLEMENTATION_ROADMAP.md'), 'utf8');

function expectReadOnlyTransaction(sql: string) {
  expect(sql.toLowerCase()).toContain('begin transaction read only;');
  expect(sql.toLowerCase()).toContain('rollback;');
  expect(sql).not.toMatch(/^\s*(insert|update|delete|merge|alter|create|drop|truncate|grant|revoke)\b/im);
}

describe('employee create read-only schema preflight package', () => {
  it('inspects metadata and fixture predicates without mutation', () => {
    expectReadOnlyTransaction(preflight);
    expectReadOnlyTransaction(validation);
    for (const evidence of [
      'information_schema.columns', 'employee_constraints', 'employee_triggers',
      'employee_rls', 'employee_policies', 'employee_grants',
      'facility_reference_shape', 'migration_ledger_metadata',
      'X_NG_CH_NH_LUMINAL', 'makerlab.marketing@gmail.com',
    ]) expect(preflight).toContain(evidence);
  });

  it('reconciles the contract, operator boundary, and roadmap', () => {
    for (const document of [contract, handoff, roadmap]) {
      expect(document).toContain('20260803_employee_create_schema_preflight.sql');
      expect(document).toContain('LIVE_APPROVAL_REQUIRED');
    }
    expect(contract).toContain('Complete insert schema expectation matrix');
    expect(handoff).toContain('Expected row and schema\nimpact are both zero');
  });
});
