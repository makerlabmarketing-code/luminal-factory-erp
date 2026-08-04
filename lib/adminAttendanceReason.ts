export const MIN_ADMIN_ATTENDANCE_REASON_LENGTH = 10;

export function normalizeRequiredAdminAttendanceReason(reason: unknown): string | null {
  if (typeof reason !== 'string') return null;
  const normalizedReason = reason.trim();
  return normalizedReason.length >= MIN_ADMIN_ATTENDANCE_REASON_LENGTH ? normalizedReason : null;
}
