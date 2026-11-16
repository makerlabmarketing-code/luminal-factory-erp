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

/**
 * A previous-day open row may coexist with today's active session only after
 * the reviewed date-scoped atomic Staff RPC has been deployed. Default OFF.
 * Do not expose this capability without multi-check being enabled as well.
 */
export function isAttendanceStaleIsolationEnabled(
  value = process.env.ATTENDANCE_STALE_ISOLATION_ENABLED,
  multiCheckEnabled = isAttendanceMultiCheckEnabled()
) {
  return value === 'true' && multiCheckEnabled;
}
