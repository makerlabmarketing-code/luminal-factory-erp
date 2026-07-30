import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const repositoryRoot = join(__dirname, '..');

function source(relativePath: string): string {
  return readFileSync(join(repositoryRoot, relativePath), 'utf8');
}

function withoutSqlComments(sql: string): string {
  return sql.replace(/^\s*--.*$/gm, '');
}

describe('Attendance Gate 2 repository package', () => {
  it('keeps normal Staff check-in and check-out independent from the recovery flag', () => {
    const staffRoute = source('app/api/staff/attendance/route.ts');
    const adminRoute = source('app/api/admin/attendance/route.ts');

    expect(staffRoute).toMatch(/export async function POST/);
    expect(staffRoute).toMatch(/\.from\('attendance'\)\s*\.update/);
    expect(staffRoute).toMatch(/supabase\s*\.from\('attendance'\)\s*\.insert/);
    expect(staffRoute).toMatch(/\.eq\('employee_id', authContext\.employee\.id\)/);
    expect(staffRoute).not.toContain('ATTENDANCE_RECOVERY_ENABLED');
    expect(adminRoute).toMatch(/process\.env\.ATTENDANCE_RECOVERY_ENABLED === 'true'/);
  });

  it('provides an audited one-row cancellation instead of a forced checkout', () => {
    const forward = source('supabase/drafts/20260730_attendance_stale_cancellation_forward.sql');
    expect(forward).toMatch(/a\.id = target_id and a\.employee_id = employee/);
    expect(forward).toContain("date '2026-05-21'");
    expect(forward).toMatch(/check_in is not null and a\.check_out is null/);
    expect(forward).toMatch(/if target_count <> 1 then raise exception/);
    expect(forward).toMatch(/if open_count <> 1 then raise exception/);
    expect(forward).toMatch(/if settlement_count <> 0 then raise exception/);
    expect(forward).toContain('set cancellation_reason = reason_text');
    expect(forward).toContain('cancelled_by_employee_id = actor');
    expect(forward).toContain('cancelled_at = stamp');
    expect(withoutSqlComments(forward)).not.toMatch(/set\s+check_out\s*=|delete\s+from\s+public\.attendance/i);
  });

  it('accepts only NULL or zero provisional totals and normalizes them on cancellation', () => {
    const preRun = source('supabase/drafts/20260730_attendance_stale_cancellation_pre_run.sql');
    const forward = source('supabase/drafts/20260730_attendance_stale_cancellation_forward.sql');
    const provisionalTotalPredicates = [
      'a.total_hours is null or a.total_hours = 0',
      'a.total_salary is null or a.total_salary = 0',
    ];

    for (const predicate of provisionalTotalPredicates) {
      expect(preRun).toContain(predicate);
      expect(forward).toContain(predicate);
    }

    expect(preRun).toMatch(/a\.check_out,\s+a\.total_hours,\s+a\.total_salary,/);
    expect(forward).toMatch(/total_hours = null,\s+total_salary = null/);
    expect(forward).toContain("'previous_total_hours', old_total_hours");
    expect(forward).toContain("'previous_total_salary', old_total_salary");
    expect(forward).not.toMatch(/a\.total_hours\s+is\s+null\s+and\s+a\.total_salary\s+is\s+null/);
  });

  it('retains immutable audit history and excludes cancellation from payroll', () => {
    const migration = source('supabase/migrations/20260730024246_attendance_cancellation_audit.sql');
    expect(migration).toMatch(/attendance_cancellation_audit_immutable[\s\S]*before update or delete/);
    expect(migration).toContain('a.cancelled_at is null');
    expect(migration).toMatch(/revoke all on public\.attendance_cancellation_audit from public, anon, authenticated/);
    expect(migration).not.toMatch(/grant\s+(insert|update|delete|all)/i);
  });

  it('aborts wrong counts, payroll links, and already-closed targets', () => {
    const forward = source('supabase/drafts/20260730_attendance_stale_cancellation_forward.sql');
    expect(forward).toContain("Expected exactly one still-open zero-contribution 2026-05-21 target row");
    expect(forward).toContain("Attendance row is referenced by % finalized payroll settlement item(s)");
    expect(forward).toMatch(/check_out is null[\s\S]*target_count <> 1/);
  });

  it('rolls back only the explicit row and preserves both audit events', () => {
    const rollback = source('supabase/rollbacks/20260730_attendance_stale_cancellation_rollback.sql');
    expect(rollback).toMatch(/where id = target_id and employee_id = employee and cancelled_at is not null/);
    expect(rollback).toMatch(/if changed_count <> 1 then raise exception/);
    expect(rollback).toContain("'ROLLBACK_RESTORED'");
    expect(rollback).toContain('total_hours = original_total_hours');
    expect(rollback).toContain('total_salary = original_total_salary');
    expect(rollback).toContain("details ? 'previous_total_hours'");
    expect(rollback).toContain("details ? 'previous_total_salary'");
    expect(rollback).not.toMatch(/delete\s+from/i);
  });

  it('preflights every relation and helper required by the tracked forward migration', () => {
    const preRun = source('supabase/drafts/20260728_attendance_recovery_pre_run.sql');

    ['attendance', 'attendance_logs', 'employees', 'shifts'].forEach((relation) => {
      expect(preRun).toContain(`'${relation}'`);
    });
    [
      'current_employee_id()',
      'has_workspace_access(text)',
      'has_permission(text)',
    ].forEach((helper) => expect(preRun).toContain(`'${helper}'`));
    expect(withoutSqlComments(preRun)).not.toMatch(/^\s*(insert|update|delete|alter|create|drop|grant|revoke)\b/im);
  });

  it('preserves own-row and permission-scoped RLS in the forward and rollback packages', () => {
    const forward = source('supabase/migrations/20260715073600_attendance_recovery_rls.sql');
    const rollback = source('supabase/rollbacks/20260715073600_attendance_recovery_rls_rollback.sql');

    expect(forward).toMatch(/employee_id = public\.current_employee_id\(\)/);
    expect(forward).toContain("public.has_workspace_access('STAFF_WORKSPACE')");
    expect(forward).toContain("public.has_workspace_access('ADMIN_WORKSPACE')");
    expect(forward).toContain("public.has_permission('ATTENDANCE_VIEW')");
    expect(forward).toContain("public.has_permission('ATTENDANCE_MANAGE')");
    expect(withoutSqlComments(forward)).not.toMatch(/\b(from|join|on)\s+(public\.)?project_members\b/i);
    expect(rollback).toMatch(/revoke select, insert, update, delete on public\.attendance/);
    expect(rollback).not.toMatch(/disable row level security/i);
  });

  it('makes post-run helper and missing-policy results explicit', () => {
    const validation = source('supabase/validation/20260715073600_attendance_recovery_rls_validation.sql');

    expect(validation).toContain("to_regprocedure('public.current_employee_id()')");
    expect(validation).toContain("to_regprocedure('public.has_workspace_access(text)')");
    expect(validation).toContain("to_regprocedure('public.has_permission(text)')");
    expect(validation).toContain('missing_policy');
    expect(validation).toMatch(/where actual\.policyname is null/);
    expect(withoutSqlComments(validation)).not.toMatch(/^\s*(insert|update|delete|alter|create|drop|grant|revoke)\b/im);
  });
});
