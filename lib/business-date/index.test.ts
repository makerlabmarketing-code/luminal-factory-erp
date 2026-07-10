import { describe, expect, it } from 'vitest';
import {
  addBusinessMonths,
  businessDateFromDateInput,
  businessDateFromInstant,
  businessMonthCalendar,
  businessMonthFromDateInput,
  businessMonthFromInstant,
  businessMonthRange,
  formatBusinessDateInput,
  formatBusinessMonthPeriod,
} from './index';

describe('Luminal business date', () => {
  it('derives Vietnam date when UTC and Vietnam calendar dates differ', () => {
    expect(businessDateFromInstant('2026-07-09T17:00:00.000Z')).toEqual({
      year: 2026,
      month: 7,
      day: 10,
    });
  });

  it('handles local midnight boundaries', () => {
    expect(businessDateFromInstant('2026-07-09T16:59:59.999Z').day).toBe(9);
    expect(businessDateFromInstant('2026-07-09T17:00:00.000Z').day).toBe(10);
  });

  it('handles local month boundaries', () => {
    expect(businessMonthFromInstant('2026-06-30T16:59:59.999Z')).toEqual({ year: 2026, month: 6 });
    expect(businessMonthFromInstant('2026-06-30T17:00:00.000Z')).toEqual({ year: 2026, month: 7 });
  });

  it('builds a start-inclusive and end-exclusive UTC month range', () => {
    const range = businessMonthRange({ year: 2026, month: 7 });
    expect(range.localStart).toEqual({ year: 2026, month: 7, day: 1 });
    expect(range.localEnd).toEqual({ year: 2026, month: 8, day: 1 });
    expect(range.queryStart.toISOString()).toBe('2026-06-30T17:00:00.000Z');
    expect(range.queryEnd.toISOString()).toBe('2026-07-31T17:00:00.000Z');
  });

  it('preserves date-only values as calendar values', () => {
    const date = businessDateFromDateInput('2026-07-01');
    expect(formatBusinessDateInput(date)).toBe('2026-07-01');
    expect(() => businessDateFromInstant('2026-07-01')).toThrow();
  });

  it('validates impossible calendar values', () => {
    expect(() => businessDateFromDateInput('2026-02-29')).toThrow();
    expect(() => businessMonthFromDateInput('2026-13')).toThrow();
  });

  it('rolls operational months without host-local Date arithmetic', () => {
    expect(addBusinessMonths({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 });
    expect(formatBusinessMonthPeriod({ year: 2027, month: 1 })).toBe('01/2027');
  });

  it('provides deterministic calendar-grid values', () => {
    expect(businessMonthCalendar({ year: 2026, month: 7 })).toEqual({ firstWeekday: 3, daysInMonth: 31 });
  });
});
