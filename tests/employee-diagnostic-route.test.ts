import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(__dirname, '..');
const source = readFileSync(join(root, 'app/api/admin/employees/diagnostics/[correlationId]/route.ts'), 'utf8');
const createRoute = readFileSync(join(root, 'app/api/admin/employees/route.ts'), 'utf8');
const actions = readFileSync(join(root, 'services/server/adminEmployeeActions.ts'), 'utf8');

describe('employee create diagnostic evidence boundary', () => {
  it('requires Admin Employee Manage and returns no-store sanitized evidence', () => {
    expect(source).toContain("requireAdminEmployeePermission('EMPLOYEE_MANAGE')");
    expect(source).toContain("Cache-Control', 'no-store, max-age=0'");
    expect(source).toContain('readEmployeeCreatePersistenceDiagnostic');
    expect(source).toContain("status: 'unavailable'");
    expect(source).not.toMatch(/raw|payload|email|phone|title|stack|sql|token|cookie|environment/i);
  });

  it('separates insert constraints and readback failures in the public create contract', () => {
    expect(actions).toContain("code: requestReachedSupabase ? 'employee_insert_constraint_failed' : 'payload_validation_failed'");
    expect(actions).toContain("code: failureStage === 'core_readback' ? 'employee_insert_readback_failed' : 'employee_persistence_failed'");
    expect(actions).toContain("requestReachedSupabase ? 'core_mutation' : failureStage");
    expect(actions).toContain("failureStage: requestReachedSupabase ? 'core_mutation' : 'permission_check'");
    expect(actions).toContain("isEmployeeInsertReadbackError(safeDetails)");
    expect(createRoute).toContain('diagnosticAvailable: Boolean(error.diagnosticAvailable)');
    expect(createRoute).toContain('fieldErrors: error.fieldErrors');
  });
});
