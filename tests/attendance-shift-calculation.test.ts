import { describe, expect, it } from 'vitest';
import {
  calculateShiftUnitsFromMinutes,
  isOpenAttendanceRecordStale,
  mergeAttendanceRecords,
} from '../services/attendanceService';

describe('attendance shift calculation', () => {
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
});
