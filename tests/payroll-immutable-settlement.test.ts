import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { calculateMonthlyPayroll } from '../services/payrollService';
import { calculateShiftUnitsFromMinutes } from '../services/attendanceService';

const migration = readFileSync('supabase/migrations/20260728100414_immutable_monthly_payroll_settlement.sql', 'utf8');
const rollback = readFileSync('supabase/rollbacks/20260728100414_immutable_monthly_payroll_settlement_rollback.sql', 'utf8');
const validation = readFileSync('supabase/validation/20260728100414_immutable_monthly_payroll_settlement_validation.sql', 'utf8');

describe('approved payroll calculation contract', () => {
  it.each([[1,1],[179,1],[180,1],[181,2],[360,2],[361,3],[900,3]])('%i minutes is %i shift units', (minutes, shifts) => expect(calculateShiftUnitsFromMinutes(minutes)).toBe(shifts));
  it('calculates salary and approved adjustments without mutating the base', () => {
    const result = calculateMonthlyPayroll(360, 30_000, 50_000);
    expect(result).toMatchObject({ workedHours: 6, baseSalary: 180_000, approvedAdjustmentAmount: 50_000, finalPayableAmount: 230_000 });
  });
});

describe('immutable payroll database contract', () => {
  it('allows one settlement per employee/month and handles duplicate settlement', () => {
    expect(migration).toContain('unique(employee_id, payroll_month)');
    expect(migration).toContain('insert into public.payroll_settlements');
  });
  it('prevents original settlement overwrite and deletion', () => {
    expect(migration).toContain('payroll_settlements_immutable before update or delete');
    expect(migration).toContain("raise exception 'immutable payroll record cannot be changed'");
  });
  it('stores adjustments separately and preserves the original settlement', () => {
    expect(migration).toContain('create table public.payroll_adjustments');
    expect(migration).toContain('settlement_id uuid not null references public.payroll_settlements');
    expect(migration).not.toMatch(/update public\.payroll_settlements/);
  });
  it('limits staff reads to their own payroll and excludes internal audit notes', () => {
    expect(migration).toContain("public.payroll_result(p_month,public.current_employee_id())");
    expect(migration).toContain("public.has_workspace_access('STAFF_WORKSPACE')");
    expect(migration).not.toMatch(/create policy[^;]+payroll_audit_history[^;]+STAFF_WORKSPACE/s);
  });
  it('requires server-side permission for settlement', () => expect(migration).toContain("not public.has_permission('PAYROLL_SETTLE')"));
  it('does not update legacy salary or attendance rows', () => {
    expect(migration).not.toMatch(/update public\.(attendance|salary|salaries)/);
    expect(migration).not.toMatch(/delete from public\.(attendance|salary|salaries)/);
  });
  it('requires explicit first month and blocks historical settlement', () => {
    expect(migration).toContain('create table public.payroll_configuration');
    expect(migration).toContain('if config_month is null');
    expect(migration).toContain('if p_month < config_month');
    expect(migration).not.toMatch(/insert into public\.payroll_settlements[\s\S]+select[\s\S]+from public\.attendance/i);
  });
  it('derives audit actor and timestamp on the server', () => {
    expect(migration).toContain('actor bigint:=public.current_employee_id()');
    expect(migration).toContain('stamp timestamptz:=clock_timestamp()');
    expect(validation).toContain('server_audit_fields_complete');
  });
  it('ships validation and guarded destructive rollback', () => {
    expect(validation).toContain('no_duplicate_settlement');
    expect(rollback).toContain('Run only after exporting payroll records');
  });
});
