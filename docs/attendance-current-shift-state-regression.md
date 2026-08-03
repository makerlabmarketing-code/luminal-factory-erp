# Attendance Current-Shift State Regression

**Status:** Admin summary `CODE_FIX_READY`; stale-row recovery
`BUSINESS_DECISION_REQUIRED`

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

## Production reconciliation

The read-only production audit found two independent data scopes:

- The employee with the stale shift has six normalized Attendance rows, all in
  May 2026. Five are completed and one is open from 21 May 2026 at 22:24 local
  time. The employee has no July Attendance rows and no legacy log rows.
- July 2026 has five normalized Attendance rows and no legacy log rows, all for
  a different employee. All five July rows are completed.

The Admin page requested month-wide data without sending the selected employee
ID. It displayed the month-wide source count of five, then filtered the
calendar locally to the selected employee. This produced an unexplained count
beside zero totals and an empty calendar.

The corrected Admin contract sends both month and selected employee to the
server. Source counts are now scoped to that request. Authorized diagnostics
separately report records in the selected month, completed rows, open rows,
stale rows, excluded rows, and records outside the selected month. Only
completed positive-duration rows contribute to finalized hours and shift
units. Diagnostics contain aggregate counts and do not expose employee PII,
attendance row IDs, or raw database errors.

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

The original authorization package establishes the RLS boundary but does not
provide audited cancellation. The business owner has now approved invalidation
of the legacy/test row without a checkout timestamp and with zero Attendance or
Payroll contribution. The reviewed cancellation migration, read-only pre-run,
one-row forward, post-run, validation, immutable audit, authorization checks,
rollback, and exact commands are owned by
`docs/attendance-stale-row-cancellation-operator-runbook.md`.

Package status is `PACKAGE_READY_FOR_OPERATOR`. Only operator-retained pre-run
evidence may establish the production target and affected-row count. Do not
execute SQL, replay a recorded migration, enable `ATTENDANCE_RECOVERY_ENABLED`,
or claim live PASS from repository preparation.

The read-only candidate search found no other active employee that
simultaneously has `STAFF_WORKSPACE`, an active Facility assignment, a linked
Auth user, and no open Attendance row. A clean-account check-in/check-out smoke
therefore requires a separately provisioned or newly eligible account; it must
not reuse the stale-row employee.

## Rollback

Revert the Attendance application commit. No schema, RLS, migration history,
runtime flag, or production row is changed by this fix.

## 2026-08-03 same-minute completion correction

Production smoke provisioned the dedicated **Maker Lab** Employee/Auth fixture
with Staff-only workspace access, the active `Xưởng chính Luminal` facility, and
a zero hourly rate. Staff check-in and immediate check-out succeeded; the Admin
read-only page showed the completed 04:18 PM–04:18 PM record. Duplicate
current-shift prevention also succeeded. The Staff entry, however, did not expose
a shared login page, and the completed record displayed zero converted shifts.

The conversion defect was application-side: finalized shift conversion reused
the raw positive-minute helper, which intentionally returns zero for zero raw
minutes, and finalized summaries excluded completed rows when worked minutes were
zero. A valid completed row now applies the approved minimum after completion and
status validation: **0–180 minutes = 1 shift, 181–360 minutes = 2 shifts, and more
than 360 minutes = 3 shifts**. Raw duration remains unchanged, so a same-minute
record still displays `0 phút`. Open, cancelled, invalid, rejected, and
recovery-only rows receive zero finalized shifts. Salary remains derived from raw
hours and hourly rate; an explicit zero rate remains zero.

The correction is dynamic. Staff history, current-shift completion, Admin monthly
summary, calendar tooltip, and detail dialog use the shared finalized conversion.
The existing Maker Lab row does not require a database update or backfill. Admin
Attendance remains read-only and Attendance recovery remains disabled. The full
Attendance gate stays open until the corrected production deployment and manual
Staff/Admin retest are retained.

## 2026-08-03 production display evidence and remaining session gate

The Maker Lab production Staff route now shows the completed 16:18–16:18 shift,
raw duration `0 phút`, and one converted shift. Check-in, check-out, duplicate
current-shift prevention, minimum completed-shift conversion, refresh
persistence, and the absence of a new Start action are verified. The zero-rate
fixture remains zero payable. Attendance recovery remains disabled and Admin
Attendance remains read-only.

The full Attendance gate is still open because Staff had no reachable logout
action for a controlled clean-session retest. The bounded Staff session slice
adds logout without changing Attendance state or mutation logic. After its
production deployment, manually verify logout, protected-route behavior,
Staff-only login routing, and the unchanged completed shift. Do not create
another Attendance row for that verification.
