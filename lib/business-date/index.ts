export const BUSINESS_TIME_ZONE = 'Asia/Ho_Chi_Minh' as const;

export type BusinessDate = Readonly<{
  year: number;
  month: number;
  day: number;
}>;

export type BusinessMonth = Readonly<{
  year: number;
  month: number;
}>;

export type BusinessMonthRange = Readonly<{
  localStart: BusinessDate;
  localEnd: BusinessDate;
  queryStart: Date;
  queryEnd: Date;
}>;

export type BusinessMonthCalendar = Readonly<{
  firstWeekday: number;
  daysInMonth: number;
}>;

const INSTANT_DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: BUSINESS_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const LOCAL_OFFSET_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: BUSINESS_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
  timeZoneName: 'longOffset',
});

function invalidCalendarValue(value: string): Error {
  return new Error(`Invalid Luminal calendar value: ${value}`);
}

function daysInMonth(year: number, month: number): number {
  if (!Number.isInteger(year) || year < 1 || year > 9999) {
    throw invalidCalendarValue(`${year}-${month}`);
  }

  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw invalidCalendarValue(`${year}-${month}`);
  }

  if (month === 2) {
    return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28;
  }

  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function assertBusinessDate(date: BusinessDate): BusinessDate {
  const maximumDay = daysInMonth(date.year, date.month);

  if (!Number.isInteger(date.day) || date.day < 1 || date.day > maximumDay) {
    throw invalidCalendarValue(formatBusinessDateInput(date));
  }

  return date;
}

function assertBusinessMonth(month: BusinessMonth): BusinessMonth {
  daysInMonth(month.year, month.month);
  return month;
}

function partsToRecord(parts: Intl.DateTimeFormatPart[]): Record<string, string> {
  return parts.reduce<Record<string, string>>((result, part) => {
    result[part.type] = part.value;
    return result;
  }, {});
}

function toInstant(value: Date | string): Date {
  if (typeof value === 'string' && /^\d{4}-\d{2}(?:-\d{2})?$/.test(value)) {
    throw new Error(`Date-only value is not an instant: ${value}`);
  }

  const instant = value instanceof Date ? new Date(value.getTime()) : new Date(value);

  if (!Number.isFinite(instant.getTime())) {
    throw new Error('Invalid instant.');
  }

  return instant;
}

function parseOffsetMilliseconds(value: string): number {
  if (value === 'GMT') return 0;

  const match = /^GMT([+-])(\d{1,2})(?::?(\d{2}))?(?::?(\d{2}))?$/.exec(value);
  if (!match) throw new Error(`Unable to resolve timezone offset: ${value}`);

  const sign = match[1] === '+' ? 1 : -1;
  const hours = Number(match[2]);
  const minutes = Number(match[3] || 0);
  const seconds = Number(match[4] || 0);

  return sign * ((hours * 60 * 60 + minutes * 60 + seconds) * 1000);
}

function offsetMillisecondsAt(instant: Date): number {
  const parts = partsToRecord(LOCAL_OFFSET_FORMATTER.formatToParts(instant));
  return parseOffsetMilliseconds(parts.timeZoneName);
}

function localBoundaryToInstant(date: BusinessDate): Date {
  assertBusinessDate(date);

  const candidateMilliseconds = Date.UTC(date.year, date.month - 1, date.day);
  const candidate = new Date(candidateMilliseconds);
  const queryMilliseconds = candidateMilliseconds - offsetMillisecondsAt(candidate);
  const resolved = new Date(queryMilliseconds);
  const resolvedDate = businessDateFromInstant(resolved);

  if (
    resolvedDate.year !== date.year ||
    resolvedDate.month !== date.month ||
    resolvedDate.day !== date.day
  ) {
    throw new Error(`Unable to resolve Luminal local boundary: ${formatBusinessDateInput(date)}`);
  }

  return resolved;
}

export function businessDateFromInstant(value: Date | string): BusinessDate {
  const parts = partsToRecord(INSTANT_DATE_FORMATTER.formatToParts(toInstant(value)));
  return assertBusinessDate({
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
  });
}

export function businessMonthFromInstant(value: Date | string): BusinessMonth {
  const date = businessDateFromInstant(value);
  return { year: date.year, month: date.month };
}

export function businessDateFromDateInput(value: string): BusinessDate {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw invalidCalendarValue(value);

  return assertBusinessDate({
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  });
}

export function businessMonthFromDateInput(value: string): BusinessMonth {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) throw invalidCalendarValue(value);

  return assertBusinessMonth({
    year: Number(match[1]),
    month: Number(match[2]),
  });
}

export function formatBusinessDateInput(date: BusinessDate): string {
  assertBusinessDate(date);
  return `${String(date.year).padStart(4, '0')}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`;
}

export function formatBusinessMonthInput(month: BusinessMonth): string {
  assertBusinessMonth(month);
  return `${String(month.year).padStart(4, '0')}-${String(month.month).padStart(2, '0')}`;
}

export function formatBusinessMonthPeriod(month: BusinessMonth): string {
  assertBusinessMonth(month);
  return `${String(month.month).padStart(2, '0')}/${month.year}`;
}

export function addBusinessMonths(month: BusinessMonth, amount: number): BusinessMonth {
  assertBusinessMonth(month);
  if (!Number.isInteger(amount)) throw new Error('Business month offset must be an integer.');

  const absoluteMonth = month.year * 12 + month.month - 1 + amount;
  const year = Math.floor(absoluteMonth / 12);
  const monthNumber = absoluteMonth - year * 12 + 1;
  return assertBusinessMonth({ year, month: monthNumber });
}

export function businessMonthRange(month: BusinessMonth): BusinessMonthRange {
  const normalizedMonth = assertBusinessMonth(month);
  const nextMonth = addBusinessMonths(normalizedMonth, 1);
  const localStart = { year: normalizedMonth.year, month: normalizedMonth.month, day: 1 } as const;
  const localEnd = { year: nextMonth.year, month: nextMonth.month, day: 1 } as const;

  return {
    localStart,
    localEnd,
    queryStart: localBoundaryToInstant(localStart),
    queryEnd: localBoundaryToInstant(localEnd),
  };
}

function weekdayForDate(date: BusinessDate): number {
  assertBusinessDate(date);
  const adjustedMonth = date.month < 3 ? date.month + 12 : date.month;
  const adjustedYear = date.month < 3 ? date.year - 1 : date.year;
  return (
    date.day +
    Math.floor((13 * (adjustedMonth + 1)) / 5) +
    adjustedYear +
    Math.floor(adjustedYear / 4) -
    Math.floor(adjustedYear / 100) +
    Math.floor(adjustedYear / 400)
  ) % 7;
}

export function businessMonthCalendar(month: BusinessMonth): BusinessMonthCalendar {
  const normalizedMonth = assertBusinessMonth(month);
  const firstWeekdaySaturdayZero = weekdayForDate({ ...normalizedMonth, day: 1 });
  return {
    firstWeekday: (firstWeekdaySaturdayZero + 6) % 7,
    daysInMonth: daysInMonth(normalizedMonth.year, normalizedMonth.month),
  };
}

export function formatBusinessDate(
  date: BusinessDate,
  options: { weekday?: 'long' | 'short' | 'narrow'; locale?: string } = {},
): string {
  assertBusinessDate(date);
  const instant = new Date(Date.UTC(date.year, date.month - 1, date.day));
  return new Intl.DateTimeFormat(options.locale || 'vi-VN', {
    timeZone: 'UTC',
    weekday: options.weekday,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(instant);
}
