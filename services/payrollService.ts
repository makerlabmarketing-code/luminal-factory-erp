const SHIFT_HOURS = 3;

export function calculateHoursFromStrings(
  timeInStr: string | null,
  timeOutStr: string | null
): number {
  if (!timeInStr || !timeOutStr) return 0;

  const dummyDate = '2026-01-01';
  const start = new Date(`${dummyDate}T${timeInStr.substring(0, 5)}`);
  const end = new Date(`${dummyDate}T${timeOutStr.substring(0, 5)}`);

  let diffMs = end.getTime() - start.getTime();

  if (diffMs < 0) {
    diffMs += 24 * 60 * 60 * 1000;
  }

  const rawHours = diffMs / (1000 * 60 * 60);

  if (rawHours <= 0) return 0;

  return Math.ceil(rawHours / SHIFT_HOURS) * SHIFT_HOURS;
}

export function calculateSalary(decimalHours: number, hourlyRate: number): number {
  if (decimalHours <= 0 || hourlyRate <= 0) return 0;

  return Math.round(decimalHours * hourlyRate);
}