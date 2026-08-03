import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(__dirname, '..');
const actions = readFileSync(join(root, 'services/server/adminEmployeeActions.ts'), 'utf8');
const createRoute = readFileSync(join(root, 'app/api/admin/employees/route.ts'), 'utf8');
const client = readFileSync(join(root, 'app/admin/employees/AdminEmployeesClient.tsx'), 'utf8');

describe('employee create same-response diagnostic boundary', () => {
  it('does not depend on an instance-local cache or a diagnostic GET', () => {
    expect(existsSync(join(root, 'app/api/admin/employees/diagnostics/[correlationId]/route.ts'))).toBe(false);
    expect(actions).not.toMatch(/recordEmployeeCreatePersistenceDiagnostic|readEmployeeCreatePersistenceDiagnostic/);
    expect(createRoute).toContain('diagnostic: error.diagnostic');
  });

  it('authorizes before processing create data or building diagnostics', () => {
    const createStart = actions.indexOf('export async function createEmployee');
    const createSource = actions.slice(createStart, actions.indexOf('export async function updateEmployee'));
    expect(createSource.indexOf("requireAdminEmployeePermission('EMPLOYEE_MANAGE')"))
      .toBeLessThan(createSource.indexOf('validateEmployeeCreateShape(input)'));
    expect(createSource.indexOf('validateEmployeeCreateShape(input)'))
      .toBeLessThan(createSource.indexOf("from('employees').insert"));
  });

  it('uses insert and readback-specific codes after Supabase is reached', () => {
    expect(actions).toContain("'employee_insert_constraint_failed'");
    expect(actions).toContain("'employee_insert_readback_failed'");
    expect(actions).toContain("'employee_insert_failed'");
    expect(actions).toContain("'employee_result_uncertain'");
    expect(actions).toContain("'employee_insert_readback'");
    expect(actions).toContain('Hãy tìm theo đúng email đã nhập trước khi thử lại.');
    expect(actions).toMatch(/if \(recovered\) return recovered;[\s\S]{0,220}throwCreatePersistenceFailure\([^;]+, 'core_readback', true\)/);
    expect(actions).toContain("throwCreatePersistenceFailure({ code: 'employee_create_result_missing' }, correlationId, String(actor.employee.id), 'core_readback', true)");
  });

  it('renders expandable safe details while retaining the form and submit lock', () => {
    expect(client).toContain('Chi tiết kỹ thuật an toàn');
    expect(client).toContain('formDiagnostic.diagnostic.operationStage');
    expect(client).toContain('formDiagnostic.diagnostic.readbackAttempted');
    expect(client).toContain('if (!formState || savingEmployee || savingEmployeeRef.current) return');
    expect(client).toContain('setFormFieldErrors(fieldErrors)');
    expect(client).toContain('result.correlationId ? ` Mã tra cứu: ${result.correlationId}.`');
    expect(client).not.toContain('Thử tạo lại');
  });

  it('returns correlation IDs but no diagnostic for authorization failures', () => {
    expect(createRoute).toContain('correlationId');
    expect(createRoute).toContain('diagnostic: error.diagnostic');
    expect(actions).not.toMatch(/requireAdminEmployeePermission[\s\S]{0,80}diagnostic/);
  });
});
