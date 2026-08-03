import { describe, expect, it } from 'vitest';
import {
  buildEmployeeCreateSafeDiagnostic,
  inferEmployeeFieldErrors,
} from '../lib/employeePersistenceDiagnostics';

describe('employee same-response persistence diagnostics', () => {
  it('returns only allowlisted safe evidence for the immediate response', () => {
    const diagnostic = buildEmployeeCreateSafeDiagnostic({
      operationStage: 'employee_insert',
      readbackAttempted: false,
      rowReturned: false,
      details: {
        errorCategory: 'database_constraint',
        supabaseErrorCode: '23514',
        supabaseColumn: 'branch_code',
        supabaseConstraint: 'employees_branch_code_fkey',
      },
    });

    expect(diagnostic).toEqual({
      available: true,
      operationStage: 'employee_insert',
      databaseCode: '23514',
      table: 'employees',
      column: 'branch_code',
      constraint: 'employees_branch_code_fkey',
      rowReturned: false,
      readbackAttempted: false,
      resultUncertain: false,
      category: 'check_violation',
    });
  });

  it('normalizes every unknown machine value to unavailable', () => {
    expect(buildEmployeeCreateSafeDiagnostic({
      operationStage: 'employee_insert_readback',
      readbackAttempted: true,
      rowReturned: false,
      details: {
        errorCategory: 'customer-secret',
        supabaseErrorCode: 'not-a-code',
        supabaseColumn: 'secret_column',
        supabaseConstraint: 'secret_constraint',
      },
    })).toMatchObject({
      databaseCode: 'unavailable', column: 'unavailable',
      constraint: 'unavailable', category: 'unavailable',
    });
  });

  it.each([
    ['23502', 'not_null_violation'],
    ['23503', 'foreign_key_violation'],
    ['23505', 'unique_violation'],
    ['23514', 'check_violation'],
    ['42501', 'insufficient_privilege'],
    ['PGRST116', 'readback_cardinality'],
  ])('maps known database code %s without database text', (databaseCode, category) => {
    expect(buildEmployeeCreateSafeDiagnostic({
      operationStage: 'employee_insert_readback',
      readbackAttempted: true,
      rowReturned: false,
      details: { supabaseErrorCode: databaseCode },
    })).toMatchObject({ databaseCode, category, resultUncertain: true });
  });

  it('maps only exact allowlisted columns and constraints to fields', () => {
    expect(inferEmployeeFieldErrors({ supabaseColumn: 'status' })).toEqual({
      employmentStatus: 'Vui lòng chọn trạng thái làm việc hợp lệ.',
    });
    expect(inferEmployeeFieldErrors({ supabaseConstraint: 'employees_email_unique' })).toEqual({
      email: 'Vui lòng kiểm tra email nhân sự.',
    });
    expect(inferEmployeeFieldErrors({ supabaseColumn: 'status_private' })).toBeUndefined();
  });

  it('has no place to retain raw database text or payload values', () => {
    const diagnostic = buildEmployeeCreateSafeDiagnostic({
      operationStage: 'employee_insert', readbackAttempted: false, rowReturned: false,
      details: { errorCategory: 'unexpected', supabaseErrorCode: '23502', supabaseColumn: 'phone' },
    });
    const serialized = JSON.stringify(diagnostic);
    for (const privateValue of [
      'raw database message', 'makerlab.marketing@gmail.com', '+84901234567',
      'Tester', 'Xưởng chính Luminal', 'SELECT *', 'sensitive-token-value',
    ]) expect(serialized).not.toContain(privateValue);
  });
});
