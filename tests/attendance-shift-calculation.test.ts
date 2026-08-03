import { describe, expect, it } from 'vitest';
import {
  calculateFinalizedAttendanceSummary,
  calculateShiftUnitsFromMinutes,
  getAttendanceShiftName,
  getEmployeeHourlyRate,
  getFinalizedShiftUnitsForRecord,
  getWorkedMinutesForRecord,
  isOpenAttendanceRecordStale,
  mergeAttendanceRecords,
  resolveAttendanceShiftState,
  summarizeAttendanceScope,
} from '../services/attendanceService';

describe('attendance shift calculation', () => {
  it('preserves an explicitly configured zero hourly rate', () => {
    expect(getEmployeeHourlyRate({ id: 1, full_name: 'Nhân sự thử', hourly_rate: 0 })).toBe(0);
  });
  it.each([
    { minutes: 1, shifts: 1 },
    { minutes: 120, shifts: 1 },
    { minutes: 180, shifts: 1 },
    { minutes: 181, shifts: 2 },
    { minutes: 360, shifts: 2 },
    { minutes: 361, shifts: 3 },
  ])('$minutes phút = $shifts ca', ({ minutes, shifts }) => {
    expect(calculateShiftUnitsFromMinutes(minutes)).toBe(shifts);
  });

  it('caps shift calculation at three shifts when worked time is over six hours', () => {
    expect(calculateShiftUnitsFromMinutes(361)).toBe(3);
    expect(calculateShiftUnitsFromMinutes(540)).toBe(3);
    expect(calculateShiftUnitsFromMinutes(720)).toBe(3);
  });

  it('keeps duplicate records as one attendance window', () => {
    const [record] = mergeAttendanceRecords([
      {
        id: 1,
        employee_id: 10,
        work_date: '2026-07-15',
        shift_name: 'Ca Sáng',
        check_in: '09:00:00',
        check_out: '10:00:00',
      },
      {
        id: 2,
        employee_id: 10,
        work_date: '2026-07-15',
        shift_name: 'Ca Sáng',
        check_in: '09:30:00',
        check_out: '12:01:00',
      },
    ]);

    expect(record.check_in).toBe('09:00:00');
    expect(record.check_out).toBe('12:01:00');
    expect(record.total_worked_minutes).toBe(181);
    expect(record.calculated_shifts).toBe(2);
  });

  it('warns only when an unfinished shift is from an earlier local date', () => {
    const openRecord = {
      id: 1,
      employee_id: 10,
      work_date: '2026-07-27',
      shift_name: 'Ca Tối',
      check_in: '22:00:00',
      check_out: null,
    };

    expect(isOpenAttendanceRecordStale(openRecord, new Date(2026, 6, 28, 8))).toBe(true);
    expect(
      isOpenAttendanceRecordStale(
        { ...openRecord, work_date: '2026-07-28' },
        new Date(2026, 6, 28, 8)
      )
    ).toBe(false);
    expect(
      isOpenAttendanceRecordStale(
        { ...openRecord, check_out: '23:00:00' },
        new Date(2026, 6, 28, 8)
      )
    ).toBe(false);
  });

  it('resolves no open shift as NO_OPEN_SHIFT', () => {
    expect(resolveAttendanceShiftState(null, new Date('2026-07-30T02:00:00.000Z')))
      .toBe('NO_OPEN_SHIFT');
  });

  it('resolves an open shift on the Vietnam business date as ACTIVE_SHIFT_TODAY', () => {
    const record = {
      id: 1,
      employee_id: 10,
      work_date: '2026-07-30',
      shift_name: 'Ca Sáng',
      check_in: '08:00:00',
      check_out: null,
    };

    expect(resolveAttendanceShiftState(record, new Date('2026-07-30T02:00:00.000Z')))
      .toBe('ACTIVE_SHIFT_TODAY');
    expect(getWorkedMinutesForRecord(record, new Date('2026-07-30T02:00:00.000Z')))
      .toBe(60);
  });

  it('resolves an earlier open shift as STALE_OPEN_SHIFT without elapsed time', () => {
    const record = {
      id: 1,
      employee_id: 10,
      work_date: '2026-07-29',
      shift_name: 'Ca Tối',
      check_in: '22:00:00',
      check_out: null,
    };

    const now = new Date('2026-07-30T02:00:00.000Z');
    expect(resolveAttendanceShiftState(record, now)).toBe('STALE_OPEN_SHIFT');
    expect(getWorkedMinutesForRecord(record, now)).toBe(0);
    expect(getFinalizedShiftUnitsForRecord(record)).toBe(0);
  });

  it('calculates shift units only for completed attendance', () => {
    const baseRecord = {
      id: 1,
      employee_id: 10,
      work_date: '2026-07-30',
      shift_name: 'Ca Sáng',
      check_in: '08:00:00',
    };

    expect(getFinalizedShiftUnitsForRecord({ ...baseRecord, check_out: null })).toBe(0);
    expect(getFinalizedShiftUnitsForRecord({ ...baseRecord, check_out: '10:00:00' })).toBe(1);
    expect(getFinalizedShiftUnitsForRecord({ ...baseRecord, check_out: '13:01:00' })).toBe(2);
    expect(getFinalizedShiftUnitsForRecord({ ...baseRecord, check_out: '14:01:00' })).toBe(3);
  });

  it('counts a same-minute valid completed record as one shift without changing raw duration', () => {
    const record = {
      id: 2,
      employee_id: 10,
      work_date: '2026-08-03',
      shift_name: 'Ca Chiều',
      check_in: '16:18:42',
      check_out: '16:18:42',
      total_hours: 0,
      status: 'PRESENT',
    };

    expect(getWorkedMinutesForRecord(record)).toBe(0);
    expect(getFinalizedShiftUnitsForRecord(record)).toBe(1);
    expect(calculateFinalizedAttendanceSummary([record])).toEqual({
      totalShifts: 1,
      totalHours: 0,
    });
    expect(mergeAttendanceRecords([record])[0].calculated_shifts).toBe(1);
  });

  it.each(['CANCELLED', 'INVALID', 'REJECTED', 'RECOVERY_ONLY'])(
    'does not grant a minimum shift to %s rows',
    (status) => {
      expect(
        getFinalizedShiftUnitsForRecord({
          id: status,
          employee_id: 10,
          work_date: '2026-08-03',
          shift_name: 'Ca Chiều',
          check_in: '16:18:00',
          check_out: '16:18:00',
          status,
        })
      ).toBe(0);
    }
  );

  it('excludes cancelled rows from finalized hours and shifts while retaining the row', () => {
    const cancelled = {
      id: 91,
      employee_id: 3,
      work_date: '2026-05-21',
      shift_name: 'Ca Sáng',
      check_in: '08:00:00',
      check_out: '11:00:00',
      total_hours: 3,
      status: 'CANCELLED',
      cancelled_at: '2026-07-30T02:00:00Z',
    };

    expect(calculateFinalizedAttendanceSummary([cancelled])).toEqual({
      totalShifts: 0,
      totalHours: 0,
    });
    expect(mergeAttendanceRecords([cancelled])).toHaveLength(1);
    expect(mergeAttendanceRecords([cancelled])[0].status).toBe('CANCELLED');
  });

  it('uses the Asia/Ho_Chi_Minh date boundary for stale detection and shift names', () => {
    const beforeMidnight = new Date('2026-07-29T16:59:59.999Z');
    const afterMidnight = new Date('2026-07-29T17:00:00.000Z');
    const openRecord = {
      id: 1,
      employee_id: 10,
      work_date: '2026-07-29',
      shift_name: 'Ca Tối',
      check_in: '22:00:00',
      check_out: null,
    };

    expect(isOpenAttendanceRecordStale(openRecord, beforeMidnight)).toBe(false);
    expect(isOpenAttendanceRecordStale(openRecord, afterMidnight)).toBe(true);
    expect(getAttendanceShiftName(new Date('2026-07-30T01:00:00.000Z'))).toBe('Ca Sáng');
  });

  it('classifies selected-month, stale, excluded, and outside-month records separately', () => {
    const summary = summarizeAttendanceScope({
      monthInput: '2026-07',
      now: new Date('2026-07-30T02:00:00.000Z'),
      records: [
        {
          id: 1,
          employee_id: 10,
          work_date: '2026-07-10',
          shift_name: 'Ca Sáng',
          check_in: '08:00:00',
          check_out: '11:00:00',
        },
        {
          id: 2,
          employee_id: 10,
          work_date: '2026-07-11',
          shift_name: 'Ca Sáng',
          check_in: '08:00:00',
          check_out: null,
        },
        {
          id: 3,
          employee_id: 10,
          work_date: '2026-07-12',
          shift_name: 'Ca Sáng',
          check_in: '08:00:00',
          check_out: '08:00:00',
        },
        {
          id: 4,
          employee_id: 10,
          work_date: '2026-05-21',
          shift_name: 'Ca Tối',
          check_in: '22:24:05',
          check_out: null,
        },
      ],
    });

    expect(summary.selectedMonth).toEqual({
      records: 3,
      completed: 2,
      open: 1,
      stale: 1,
      excluded: 0,
    });
    expect(summary.outsideSelectedMonth).toEqual({
      records: 1,
      open: 1,
      stale: 1,
      excluded: 0,
    });
  });

  it('aggregates every valid completed row while preserving zero raw duration', () => {
    const summary = calculateFinalizedAttendanceSummary([
      {
        id: 1,
        employee_id: 10,
        work_date: '2026-07-10',
        shift_name: 'Ca Sáng',
        check_in: '08:00:00',
        check_out: '11:00:00',
      },
      {
        id: 2,
        employee_id: 10,
        work_date: '2026-07-11',
        shift_name: 'Ca Sáng',
        check_in: '08:00:00',
        check_out: null,
      },
      {
        id: 3,
        employee_id: 10,
        work_date: '2026-07-12',
        shift_name: 'Ca Sáng',
        check_in: '08:00:00',
        check_out: '08:00:00',
      },
    ]);

    expect(summary).toEqual({ totalShifts: 2, totalHours: 3 });
  });
});
