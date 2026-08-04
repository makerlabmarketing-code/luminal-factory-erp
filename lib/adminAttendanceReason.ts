export const DEFAULT_ADMIN_ATTENDANCE_CREATE_REASON = 'Bổ sung thủ công bởi quản trị viên';
export const MIN_ADMIN_ATTENDANCE_REASON_LENGTH = 10;

export function normalizeAdminAttendanceCreateReason(reason: unknown): string {
  const normalizedReason = typeof reason === 'string' ? reason.trim() : '';
  return normalizedReason.length >= MIN_ADMIN_ATTENDANCE_REASON_LENGTH
    ? normalizedReason
    : DEFAULT_ADMIN_ATTENDANCE_CREATE_REASON;
}

export function normalizeRequiredAdminAttendanceReason(reason: unknown): string | null {
  if (typeof reason !== 'string') return null;
  const normalizedReason = reason.trim();
  return normalizedReason.length >= MIN_ADMIN_ATTENDANCE_REASON_LENGTH ? normalizedReason : null;
}
