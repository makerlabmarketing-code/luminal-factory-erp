import { describe, expect, it } from 'vitest';
import {
  buildEmployeeCreatePersistenceDiagnostics,
  inferEmployeeFieldErrors,
} from '../lib/employeePersistenceDiagnostics';

describe('employee persistence diagnostics', () => {
  it('retains only allowlisted safe diagnostics and no payload fields', () => {
    const diagnostics = buildEmployeeCreatePersistenceDiagnostics({
      correlationId: 'safe-correlation-id',
      failureStage: 'core_mutation',
      requestReachedSupabase: true,
      readbackAttempted: false,
      rowCreated: false,
      details: {
        errorCategory: 'database_constraint',
        supabaseErrorCode: '23514',
        supabaseColumn: 'branch_code',
        supabaseConstraint: 'employees_branch_code_fkey',
      },
    });

    expect(diagnostics).toMatchObject({
      operation: 'employee_create',
      table: 'employees',
      supabaseColumn: 'branch_code',
      supabaseConstraint: 'employees_branch_code_fkey',
      insertReturnedRowCount: 0,
      readbackAttempted: false,
    });
    expect(JSON.stringify(diagnostics)).not.toContain('makerlab.marketing@gmail.com');
    expect(JSON.stringify(diagnostics)).not.toContain('Xưởng chính Luminal');
  });

  it('redacts unknown columns and constraints instead of guessing a field', () => {
    expect(inferEmployeeFieldErrors({ supabaseColumn: 'name_suffix', supabaseConstraint: 'secret_constraint' })).toBeUndefined();
    expect(buildEmployeeCreatePersistenceDiagnostics({
      failureStage: 'core_mutation',
      requestReachedSupabase: true,
      readbackAttempted: false,
      rowCreated: false,
      details: { supabaseColumn: 'name_suffix', supabaseConstraint: 'secret_constraint' },
    })).toMatchObject({ supabaseColumn: null, supabaseConstraint: null });
  });

  it('retains only five-digit PostgreSQL error codes', () => {
    expect(buildEmployeeCreatePersistenceDiagnostics({
      failureStage: 'core_mutation',
      requestReachedSupabase: true,
      readbackAttempted: false,
      rowCreated: false,
      details: { supabaseErrorCode: '23514' },
    }).supabaseErrorCode).toBe('23514');
    expect(buildEmployeeCreatePersistenceDiagnostics({
      failureStage: 'core_mutation',
      requestReachedSupabase: true,
      readbackAttempted: false,
      rowCreated: false,
      details: { supabaseErrorCode: 'not-a-code' },
    }).supabaseErrorCode).toBeNull();
  });

  it('maps exact known database columns without substring collisions', () => {
    expect(inferEmployeeFieldErrors({ supabaseColumn: 'status' })).toEqual({
      employmentStatus: 'Vui lòng chọn trạng thái làm việc hợp lệ.',
    });
    expect(inferEmployeeFieldErrors({ supabaseColumn: 'name_suffix' })).toBeUndefined();
  });
});
