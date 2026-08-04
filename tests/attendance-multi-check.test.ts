import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  canContinueAttendanceShift,
  calculateShiftUnitsFromMinutes,
  getFinalizedShiftUnitsForRecord,
  getWorkedMinutesForRecord,
  mergeAttendanceRecords,
} from '../services/attendanceService';

const root = join(__dirname, '..');
const source = (path: string) => readFileSync(join(root, path), 'utf8');

describe('Attendance multi-check contract', () => {
  it('aggregates earliest check-in and latest check-out, including breaks', () => {
    const [record] = mergeAttendanceRecords([
      { id: 1, employee_id: 7, work_date: '2026-08-04', shift_name: 'Ca Chiều', check_in: '08:00:00', check_out: '09:00:00' },
      { id: 2, employee_id: 7, work_date: '2026-08-04', shift_name: 'Ca Chiều', check_in: '09:30:00', check_out: '11:30:00' },
    ]);

    expect(record.check_in).toBe('08:00:00');
    expect(record.check_out).toBe('11:30:00');
    expect(getWorkedMinutesForRecord(record)).toBe(210);
    expect(record.calculated_shifts).toBe(2);
  });

  it.each([
    [0, 1], [180, 1], [181, 2], [360, 2], [361, 3],
  ])('uses approved conversion boundary %i => %i shifts', (minutes, shifts) => {
    if (minutes === 0) {
      expect(getFinalizedShiftUnitsForRecord({ id: 1, employee_id: 7, work_date: '2026-08-04', shift_name: 'Ca Chiều', check_in: '10:00:00', check_out: '10:00:00' })).toBe(shifts);
    } else {
      expect(calculateShiftUnitsFromMinutes(minutes)).toBe(shifts);
    }
  });

  it('allows continuation only for the same current shift and enabled capability', () => {
    const record = {
      id: 1,
      employee_id: 7,
      work_date: '2026-08-04',
      shift_name: 'Ca Chiều',
      check_in: '08:00:00',
      check_out: '11:30:00',
    };
    expect(canContinueAttendanceShift({ record, currentShiftName: 'Ca Chiều', multiCheckEnabled: true })).toBe(true);
    expect(canContinueAttendanceShift({ record, currentShiftName: 'Ca Tối', multiCheckEnabled: true })).toBe(false);
    expect(canContinueAttendanceShift({ record, currentShiftName: 'Ca Chiều', multiCheckEnabled: false })).toBe(false);
  });

  it('uses the atomic RPC when the multi-check capability is enabled', () => {
    const route = source('app/api/staff/attendance/route.ts');
    expect(route).toContain("staff_attendance_multi_mutation");
    expect(route).toContain('isAttendanceMultiCheckEnabled()');
    expect(route).toContain('record: data');
  });

  it('keeps Admin mutations independently gated and reasoned', () => {
    const route = source('app/api/admin/attendance/route.ts');
    expect(route).toContain('isAttendanceManualMutationEnabled()');
    expect(route).toContain('admin_attendance_mutation');
    expect(route).toContain('requiredReason');
    expect(route).not.toContain('ATTENDANCE_RECOVERY_ENABLED');
    expect(route).toContain("code === '23505' ? 409");
    expect(route).toContain("publicCode = code === '23505'");
  });

  it('does not trigger a post-mutation full Staff fetch', () => {
    const client = source('app/staff/attendance/AttendanceView.tsx');
    expect(client).toContain('applyMutationRecord(result.record)');
    expect(client).toMatch(/applyMutationRecord\(result\.record\);\s*showToast/);
  });

  it('keeps RPC and audit SQL draft-only and fail-closed by operator gate', () => {
    const forward = source('supabase/drafts/20260804_attendance_multi_check_admin_mutations_forward.sql');
    const rollback = source('supabase/drafts/20260804_attendance_multi_check_admin_mutations_rollback.sql');
    const preflight = source('supabase/drafts/20260804_attendance_multi_check_admin_mutations_preflight.sql');
    expect(forward).toContain('attendance_employee_date_shift_active_idx');
    expect(forward).toContain('attendance_operation_audit');
    expect(forward).toContain('attendance_cancellation_audit');
    expect(forward).toContain('staff_attendance_multi_mutation');
    expect(forward).toContain("timezone('Asia/Ho_Chi_Minh', clock_timestamp())");
    expect(forward).toContain('pg_advisory_xact_lock(actor)');
    expect(forward).toContain("check_in is not null and check_out is null");
    expect(forward).toContain('admin_attendance_mutation');
    expect(forward).toContain('has_permission(\'ATTENDANCE_MANAGE\')');
    expect(rollback).toContain('Refusing rollback: attendance operation audit history is non-empty');
    expect(preflight).toContain('having count(*) > 1');
  });
});
