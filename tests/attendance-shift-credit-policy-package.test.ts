import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(path, 'utf8');
const forward = source('supabase/drafts/20260908_attendance_shift_credit_policy_forward.sql');
const rollback = source('supabase/drafts/20260908_attendance_shift_credit_policy_rollback.sql');
const validation = source('supabase/drafts/20260908_attendance_shift_credit_policy_validation.sql');
const specification = source('docs/attendance-shift-credit-policy-20260908.md');

describe('attendance shift credit policy package', () => {
  it('documents the approved minute boundaries and immutable payroll behavior', () => {
    expect(specification).toContain('dưới 30 phút: 0 công ca');
    expect(specification).toContain('3 giờ 30 phút đến 6 giờ 29 phút: 2 công ca');
    expect(specification).toContain('Không sửa các bản quyết toán lương bất biến đã chốt.');
  });

  it('uses one database-owned formula for attendance writes and payroll reads', () => {
    expect(forward).toContain('public.attendance_shift_units(actual_minutes)');
    expect(forward).toContain('attendance_credited_salary_before_write');
    expect(forward).toContain('public.payroll_month_calculation');
    expect(forward).toContain('least(3, 1 + ((p_worked_minutes - 30) / 180))');
  });

  it('keeps internal security-definer helpers unavailable to Data API roles', () => {
    expect(forward).toContain('set search_path = public, auth, pg_temp');
    expect(forward).toContain('revoke all on function public.apply_attendance_credited_salary() from public, anon, authenticated');
    expect(forward).toContain('revoke all on function public.payroll_month_calculation(bigint, date) from public, anon, authenticated');
  });

  it('ships read-only validation and a non-destructive rollback', () => {
    expect(validation.split('\n')[0]).toBe('-- READ-ONLY POST-FORWARD VALIDATION');
    expect(validation).not.toMatch(/\b(insert|update|delete|alter|create|drop|grant|revoke|truncate)\b/i);
    expect(rollback).toContain('does not mutate attendance or immutable payroll settlement rows');
    expect(rollback).not.toMatch(/\b(update|delete|truncate)\s+public\.(attendance|payroll_settlements)/i);
  });
});
