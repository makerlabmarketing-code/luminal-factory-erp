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
