import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  isAttendanceStaleIsolationEnabled,
} from '../lib/attendanceManualMutationGate';
import {
  resolveAttendanceShiftState,
  getFinalizedShiftUnitsForRecord,
  getWorkedMinutesForRecord,
} from '../services/attendanceService';

const root = join(__dirname, '..');
const file = (path: string) => readFileSync(join(root, path), 'utf8');
const route = file('app/api/staff/attendance/route.ts');
const client = file('app/staff/attendance/AttendanceView.tsx');
const sql = file('supabase/drafts/attendance-stale-isolation/forward.sql');
const rollback = file('supabase/drafts/attendance-stale-isolation/rollback.sql');
const preflight = file('supabase/drafts/attendance-stale-isolation/preflight.sql');
const validation = file('supabase/drafts/attendance-stale-isolation/validation.sql');

const stale = {
  id: 11,
  employee_id: 3,
  work_date: '2026-11-12',
  shift_name: 'Ca Chiều',
  check_in: '16:13:00',
  check_out: null,
  status: 'PRESENT',
};
const today = {
  id: 19,
  employee_id: 3,
  work_date: '2026-11-16',
  shift_name: 'Ca Chiều',
  check_in: '12:31:00',
  check_out: null,
  status: 'PRESENT',
};
const now = new Date('2026-11-16T05:15:00.000Z');

describe('Attendance old missing-checkout isolation (deployment gated)', () => {
  it('stays OFF unless explicitly enabled AND the atomic multi-check RPC is enabled', () => {
    expect(isAttendanceStaleIsolationEnabled(undefined, false)).toBe(false);
    expect(isAttendanceStaleIsolationEnabled('true', false)).toBe(false);
    expect(isAttendanceStaleIsolationEnabled('false', true)).toBe(false);
    expect(isAttendanceStaleIsolationEnabled('true', true)).toBe(true);
  });

  it('never counts a stale uncompleted row as worked hours, shifts or payroll', () => {
    expect(resolveAttendanceShiftState(stale, now)).toBe('STALE_OPEN_SHIFT');
    expect(getWorkedMinutesForRecord(stale, now)).toBe(0);
    expect(getFinalizedShiftUnitsForRecord(stale)).toBe(0);
    expect(resolveAttendanceShiftState(today, now)).toBe('ACTIVE_SHIFT_TODAY');
  });

  it('keeps legacy all-date rejection unless the rollout flag enables isolation', () => {
    expect(route).toContain('!staleIsolationEnabled && openRecord && isOpenAttendanceRecordStale');
    expect(route).toContain('staleIsolationEnabled ? todayStr : undefined');
    expect(route).toContain('assertNoOpenAttendanceForCheckIn(currentOpenRecord)');
  });

  it('uses a current-day row for checkout and preserves prior unfinished rows', () => {
    expect(route).toContain("await getOpenAttendanceRecord(authContext.employee.id, todayStr)");
    expect(route).toContain("await getPreviousOpenAttendanceRecord(employee.id, todayStr)");
    expect(route).toContain(".lt('work_date', currentWorkDate)");
    expect(route).toContain("calculateHoursFromStrings(currentOpenRecord.check_in || null, timeOut)");
    expect(route).toContain(".eq('id', currentOpenRecord.id)");
    expect(route).not.toContain("check_out: staleOpenShift");
    expect(route).not.toContain("check_out: openRecord.check_in");
  });

  it('allows today active state and missing historical checkout notice to coexist in the UI', () => {
    expect(route).toContain('staleOpenShift,');
    expect(route).toContain('staleIsolationEnabled,');
    expect(client).toContain('{staleOpenShift && (');
    expect(client).toContain("Ca cũ chưa được tính công.");
    expect(client).toContain("(shiftState !== 'STALE_OPEN_SHIFT' || staleIsolationEnabled)");
    expect(client).toContain('Hệ thống không tự điền giờ ra.');
  });

  it('only scopes the two atomic SQL guards to today; keeps Staff auth, lock and salary calculation', () => {
    expect(sql).toMatch(/-- DRAFT ONLY/);
    expect(sql).toContain("timezone('Asia/Ho_Chi_Minh', clock_timestamp())");
    expect(sql).toContain('pg_advisory_xact_lock(actor)');
    expect(sql).toContain("has_workspace_access('STAFF_WORKSPACE')");
    expect(sql.match(/where employee_id = actor and cancelled_at is null\s+and work_date = p_work_date\s+and check_in is not null and check_out is null/g)).toHaveLength(2);
    expect(sql).toContain("where id = row_value.id");
    expect(sql).toContain('total_salary');
    expect(sql).toContain('credited_hours := credited_shifts * 3');
    expect(sql).toContain('when worked_minutes <= 180 then 1');
    expect(sql).toContain('when worked_minutes <= 360 then 2');
    expect(sql).not.toMatch(/\b(create|alter|drop)\s+table\b/i);
    expect(sql).not.toContain("grant execute");
  });

  it('keeps rollback and read-only operator proof separate from production migrations', () => {
    expect(rollback).toContain('Disable ATTENDANCE_STALE_ISOLATION_ENABLED');
    expect(rollback).toContain('credited_hours := credited_shifts * 3');
    expect(rollback.match(/where employee_id = actor and cancelled_at is null\s+and check_in is not null and check_out is null/g)).toHaveLength(2);
    expect(preflight).toContain('READ-ONLY PREFLIGHT');
    expect(validation).toContain('READ-ONLY POST-DEPLOY VALIDATION');
    expect(preflight).not.toMatch(/\b(insert|update|delete|create|alter|drop|truncate)\s+(into|table|public\.)/i);
    expect(validation).not.toMatch(/\b(insert|update|delete|create|alter|drop|truncate)\s+(into|table|public\.)/i);
  });
});
