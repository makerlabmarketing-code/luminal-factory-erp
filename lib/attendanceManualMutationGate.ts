/**
 * Manual Attendance mutations are deliberately independent from recovery.
 * The server-only environment gate remains closed until the audited RPC and
 * its schema package have been verified by an operator.
 */
export function isAttendanceManualMutationEnabled(value = process.env.ATTENDANCE_MANUAL_MUTATIONS_ENABLED) {
  return value === 'true';
}

export function isAttendanceMultiCheckEnabled(value = process.env.ATTENDANCE_MULTI_CHECK_ENABLED) {
  return value === 'true';
}
