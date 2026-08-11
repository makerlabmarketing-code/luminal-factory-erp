const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR;

export function calculateHoursFromStrings(
  timeInStr: string | null,
  timeOutStr: string | null
): number {
  return calculateActualHoursFromMinutes(calculateWorkedMinutesFromStrings(timeInStr, timeOutStr));
}

function parseTimeToMinutes(value: string | null): number | null {
  if (!value) return null;

  const match = value.match(/^(\d{1,2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/);
  if (!match) return null;

  const hour = Number(match[1]);
  const minute = Number(match[2]);

  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;

  return hour * MINUTES_PER_HOUR + minute;
}

export function calculateWorkedMinutesFromStrings(
  timeInStr: string | null,
  timeOutStr: string | null
): number {
  if (!timeInStr || !timeOutStr) return 0;

  const startMinutes = parseTimeToMinutes(timeInStr);
  const endMinutes = parseTimeToMinutes(timeOutStr);
  if (startMinutes === null || endMinutes === null) return 0;

  let workedMinutes = endMinutes - startMinutes;
  if (workedMinutes < 0) {
    workedMinutes += MINUTES_PER_DAY;
  }

  return workedMinutes > 0 ? workedMinutes : 0;
}

export function calculateActualHoursFromMinutes(workedMinutes: number): number {
  if (!Number.isFinite(workedMinutes) || workedMinutes <= 0) return 0;

  return Number((workedMinutes / MINUTES_PER_HOUR).toFixed(2));
}

export function calculateSalary(decimalHours: number, hourlyRate: number): number {
  if (decimalHours <= 0 || hourlyRate <= 0) return 0;
  return Math.round(decimalHours * hourlyRate);
}

export function calculateMonthlyPayroll(
  workedMinutes: number,
  hourlyRate: number,
  approvedAdjustmentAmount = 0
) {
  const workedHours = calculateActualHoursFromMinutes(workedMinutes);
  const baseSalary = calculateSalary(workedHours, hourlyRate);

  return {
    workedMinutes,
    workedHours,
    baseSalary,
    approvedAdjustmentAmount,
    finalPayableAmount: baseSalary + approvedAdjustmentAmount,
  };
}
