export const MAX_EMPLOYEE_HOURLY_RATE = 999_999_999_999.99;

export type EmployeeHourlyRateValidation =
  | { ok: true; value: number }
  | { ok: false; message: string };

const HOURLY_RATE_PATTERN = /^\d+(?:\.\d{1,2})?$/;

export function validateEmployeeHourlyRate(value: unknown): EmployeeHourlyRateValidation {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return { ok: false, message: 'Vui lòng nhập mức lương theo giờ hợp lệ.' };
  }

  const normalized = typeof value === 'string' ? value.trim() : String(value);
  if (normalized.startsWith('-')) {
    return { ok: false, message: 'Mức lương theo giờ không được là số âm.' };
  }
  if (!normalized || !HOURLY_RATE_PATTERN.test(normalized)) {
    return {
      ok: false,
      message: 'Mức lương theo giờ phải là số không âm và có tối đa 2 chữ số thập phân.',
    };
  }

  const hourlyRate = Number(normalized);
  if (!Number.isFinite(hourlyRate)) {
    return { ok: false, message: 'Vui lòng nhập mức lương theo giờ hợp lệ.' };
  }
  if (hourlyRate > MAX_EMPLOYEE_HOURLY_RATE) {
    return { ok: false, message: 'Mức lương theo giờ vượt quá giới hạn dữ liệu cho phép.' };
  }

  return { ok: true, value: hourlyRate };
}
