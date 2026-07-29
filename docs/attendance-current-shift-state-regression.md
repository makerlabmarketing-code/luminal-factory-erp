# Attendance Current-Shift State Regression

**Status:** `CODE_FIX_READY`

**Production state:** not deployed or smoke-tested. Facility smoke Fixture 4 remains
incomplete, Facility Fixture 5 is blocked, and Attendance Gate 2 has not started.

## Root cause

The Staff Attendance GET boundary selected the newest unfinished
`public.attendance` row without restricting it to the current Vietnam business
date. It returned that historical row as `todayRecord` with `isInShift=true`.
The client then treated every unfinished `todayRecord` as a current shift,
calculated elapsed time from its historical date, converted that provisional
duration to three shifts, and rendered the normal checkout action.

The client used one POST toggle for both check-in and checkout. It requested GPS
before either action, ignored the persisted mutation result, and waited for a
full GET refresh. The server update checked only for a database error and did
not verify that an updated row was returned, so a zero-row RLS/concurrency result
could be reported as success while the UI remained stale.

The supplied production evidence does not prove that checkout persisted. The
previous client could stop before sending POST when GPS failed, or the previous
server could report success after a zero-row update. Production request and
database evidence are required to classify that individual attempt.

## Corrected contract

The API now returns an explicit state:

- `NO_OPEN_SHIFT`
- `ACTIVE_SHIFT_TODAY`
- `STALE_OPEN_SHIFT`

Vietnam business dates and shift names use `Asia/Ho_Chi_Minh`. A stale open row
is never used for today's elapsed duration or finalized shift count. Check-in
requests GPS only after the user selects **Bắt đầu ca**. Checkout requires a
current-day open row, returns the persisted completed row, and returns refreshed
current-shift and selected-month history data. The client applies that response
before a background no-store refresh and retains its selected month.

Current/open shift resolution and Staff mutations use `public.attendance`.
Selected-month history uses the existing normalized history loader, which reads
and merges `public.attendance` and legacy `public.attendance_logs`.

## Existing stale production row

The normal Staff checkout contract must not close a previous-date row. It stores
a time-only checkout and cannot safely infer the historical checkout date or an
approved duration. Closing it automatically could corrupt historical attendance
and payroll inputs.

The existing row therefore requires operator review through the prepared
Attendance recovery package:

1. Read-only pre-run:
   `supabase/drafts/20260728_attendance_recovery_pre_run.sql`
2. Tracked forward package, migration-history verification only:
   `supabase/migrations/20260715073600_attendance_recovery_rls.sql`
3. Post-run validation:
   `supabase/validation/20260715073600_attendance_recovery_rls_validation.sql`
4. Rollback:
   `supabase/rollbacks/20260715073600_attendance_recovery_rls_rollback.sql`

Status: `READY_FOR_OPERATOR`. Do not replay a migration already recorded
remotely. Do not execute SQL or enable `ATTENDANCE_RECOVERY_ENABLED` from this
application task.

## Rollback

Revert the Attendance application commit. No schema, RLS, migration history,
runtime flag, or production row is changed by this fix.
