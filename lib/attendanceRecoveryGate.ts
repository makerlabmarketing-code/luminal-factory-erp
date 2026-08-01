export type AttendanceRecoveryStatus = 'enabled' | 'disabled';

export function attendanceRecoveryStatus(value: unknown): AttendanceRecoveryStatus {
  return value === 'true' ? 'enabled' : 'disabled';
}

export function isAttendanceRecoveryEnabled(value: unknown): boolean {
  return attendanceRecoveryStatus(value) === 'enabled';
}
