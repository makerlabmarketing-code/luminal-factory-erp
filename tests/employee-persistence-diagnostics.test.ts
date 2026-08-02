import { describe, expect, it } from 'vitest';
import {
  buildEmployeeCreatePersistenceDiagnostics,
  inferEmployeeFieldErrors,
  isEmployeeDiagnosticCorrelationId,
  readEmployeeCreatePersistenceDiagnostic,
  recordEmployeeCreatePersistenceDiagnostic,
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
      rowReturned: false,
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

  it('retains normalized PostgreSQL and PostgREST error codes', () => {
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
    expect(buildEmployeeCreatePersistenceDiagnostics({
      failureStage: 'core_readback',
      requestReachedSupabase: true,
      readbackAttempted: true,
      rowCreated: false,
      details: { supabaseErrorCode: 'PGRST116' },
    }).supabaseErrorCode).toBe('PGRST116');
  });

  it('maps exact known database columns without substring collisions', () => {
    expect(inferEmployeeFieldErrors({ supabaseColumn: 'status' })).toEqual({
      employmentStatus: 'Vui lòng chọn trạng thái làm việc hợp lệ.',
    });
    expect(inferEmployeeFieldErrors({ supabaseColumn: 'name_suffix' })).toBeUndefined();
  });

  it('stores only short-lived correlation diagnostics for the operator surface', () => {
    const correlationId = 'c462020c-26ba-4b80-a083-da696ae38539';
    const now = new Date('2026-08-02T14:30:00.000Z');
    const diagnostic = buildEmployeeCreatePersistenceDiagnostics({
      correlationId,
      failureStage: 'core_mutation',
      requestReachedSupabase: true,
      readbackAttempted: false,
      rowCreated: false,
      details: { errorCategory: 'database_constraint', supabaseErrorCode: '23514' },
    });

    expect(recordEmployeeCreatePersistenceDiagnostic(diagnostic, now)).toBe(true);
    expect(readEmployeeCreatePersistenceDiagnostic(correlationId, new Date('2026-08-02T14:35:00.000Z')))
      .toMatchObject({ correlationId, timestamp: now.toISOString(), failureStage: 'core_mutation' });
    expect(readEmployeeCreatePersistenceDiagnostic(correlationId, new Date('2026-08-02T14:46:00.000Z'))).toBeNull();
  });

  it('accepts only UUID correlation identifiers', () => {
    expect(isEmployeeDiagnosticCorrelationId('0831171c-11bc-4007-b29d-c62282fe0a40')).toBe(true);
    expect(isEmployeeDiagnosticCorrelationId('safe-correlation-id')).toBe(false);
  });
});
