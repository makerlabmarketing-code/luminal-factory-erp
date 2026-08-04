import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  canContinueAttendanceShift,
  canStartAttendanceShift,
  getWorkedMinutesForRecord,
  resolveAttendanceShiftState,
} from '../services/attendanceService';

const repositoryRoot = join(__dirname, '..');
const source = (relativePath: string) => readFileSync(join(repositoryRoot, relativePath), 'utf8');

const afternoonOpen = {
  id: 42,
  employee_id: 7,
  work_date: '2026-08-04',
  shift_name: 'Ca Chiều',
  check_in: '16:00:00',
  check_out: null,
};

describe('Attendance shift-transition rule', () => {
  it('keeps an open afternoon Attendance active after evening begins', () => {
    const eveningNow = new Date('2026-08-04T12:00:00.000Z');

    expect(resolveAttendanceShiftState(afternoonOpen, eveningNow)).toBe('ACTIVE_SHIFT_TODAY');
    expect(canStartAttendanceShift({
      record: afternoonOpen,
      currentShiftName: 'Ca Tối',
      multiCheckEnabled: true,
    })).toBe(false);
    expect(getWorkedMinutesForRecord(afternoonOpen, eveningNow)).toBe(180);
  });

  it('allows a completed afternoon Attendance to expose evening Start', () => {
    const completedAfternoon = { ...afternoonOpen, check_out: '18:30:00' };

    expect(canStartAttendanceShift({
      record: completedAfternoon,
      currentShiftName: 'Ca Tối',
      multiCheckEnabled: false,
    })).toBe(true);
  });

  it('preserves same-shift continuation and blocks repeated same-shift starts', () => {
    const completedAfternoon = { ...afternoonOpen, check_out: '17:00:00' };

    expect(canContinueAttendanceShift({
      record: completedAfternoon,
      currentShiftName: 'Ca Chiều',
      multiCheckEnabled: true,
    })).toBe(true);
    expect(canStartAttendanceShift({
      record: completedAfternoon,
      currentShiftName: 'Ca Chiều',
      multiCheckEnabled: false,
    })).toBe(false);
  });

  it('keeps the server check-in guard independent from shift labels', () => {
    const route = source('app/api/staff/attendance/route.ts');

    expect(route).toMatch(/getOpenAttendanceRecord\(authContext\.employee\.id\)/);
    expect(route).toMatch(/assertNoOpenAttendanceForCheckIn\(openRecord\)/);
    expect(route).toMatch(/assertNoOpenAttendanceForCheckIn\(openRecordAfterLocation\)/);
    expect(route).toMatch(/\.is\('check_out', null\)/);
    expect(route).toContain('any shift/date blocks every new check-in');
  });

  it('keeps only the active row and checkout action while a shift remains open', () => {
    const client = source('app/staff/attendance/AttendanceView.tsx');

    expect(client).toMatch(/shiftState === 'ACTIVE_SHIFT_TODAY' && currentShift/);
    expect(client).toMatch(/shiftState === 'ACTIVE_SHIFT_TODAY'[\s\S]*'Kết thúc ca'/);
    expect(client).toMatch(/canStartCurrentShift/);
    expect(client).toMatch(/shiftState === 'NO_OPEN_SHIFT' && todayRecord\?\.check_out/);
  });

  it('reevaluates the current shift after successful checkout', () => {
    const client = source('app/staff/attendance/AttendanceView.tsx');

    expect(client).toMatch(/if \(action === 'check_out'\)/);
    expect(client).toMatch(/await loadAttendanceData\(historyMonthInput, \{[\s\S]*showLoading: false/);
    expect(client).toMatch(/if \(!refreshed\) applyMutationRecord\(result\.record\)/);
  });

  it('preserves the earlier open shift on refresh instead of resolving the new shift', () => {
    const route = source('app/api/staff/attendance/route.ts');

    expect(route).toMatch(/const openRecord = await getOpenAttendanceRecord\(employee\.id\)/);
    expect(route).toMatch(/shiftState === 'ACTIVE_SHIFT_TODAY'\s*\? openRecord/);
    expect(route).toMatch(/currentShift: shiftState === 'ACTIVE_SHIFT_TODAY' \? openRecord : null/);
  });

  it('keeps duplicate clicks from issuing another check-in and retains the server recheck', () => {
    const client = source('app/staff/attendance/AttendanceView.tsx');
    const route = source('app/api/staff/attendance/route.ts');

    expect(client).toMatch(/if \(submitLockRef\.current\) return/);
    expect(client).toMatch(/submitLockRef\.current = true/);
    expect(route).toMatch(/openRecordAfterLocation/);
    expect(route).toMatch(/assertNoOpenAttendanceForCheckIn\(openRecordAfterLocation\)/);
  });
});
