# Attendance stale-row audited cancellation operator runbook

**Status:** `PACKAGE_READY_FOR_OPERATOR` — no production SQL has been run and no
production row ID or affected-row evidence is claimed.

## Reviewed capability

The prior Attendance recovery package is an authorization/RLS foundation. It
allows permission-scoped adjustment, but it has no cancellation state, actor,
reason, timestamp, immutable cancellation history, payroll exclusion, or
one-row recovery/rollback procedure. It must not be used to force a checkout.

The new package adds explicit cancellation metadata and immutable audit history.
Cancelled rows remain queryable but contribute zero finalized Attendance hours
or shifts and are excluded by `payroll_month_calculation`. The row's checkout
stays `NULL`; no row is deleted. Rollback clears only the cancellation metadata captured for the explicit cancellation event and appends
a rollback audit event instead of erasing history.

## Required operator evidence

Before continuing, retain outputs proving all of the following:

- the supplied target ID and employee ID `3` identify exactly one still-open row
  dated `2026-05-21`;
- that row's provisional `total_hours` and `total_salary` are each either
  `NULL` or exactly zero; any non-zero value requires a business decision;
- that row is employee 3's only open, non-cancelled Attendance row;
- no finalized payroll settlement summary references the target ID;
- the supplied actor is active and has effective `ADMIN_WORKSPACE` plus
  `ATTENDANCE_MANAGE` authorization;
- no mutation grant exists on `attendance_cancellation_audit` for `PUBLIC`,
  `anon`, or `authenticated`.

The expected production affected-row count is one, but only retained operator
output may establish that fact. Stop on any discrepancy; do not edit the SQL to
weaken an assertion.

## Exact local operator sequence

Run from the repository root after the migration in this PR has been reviewed,
merged through protected `main`, and applied by the approved Supabase GitHub
Integration. Do not replay migrations manually. Use a separately supplied,
operator-controlled PostgreSQL connection in `DATABASE_URL`; never paste it into
logs or commit it.

```bash
export TARGET_ROW_ID='<operator-verified-attendance-row-id>'
export EMPLOYEE_ID='3'
export ACTOR_EMPLOYEE_ID='<operator-employee-id>'
export CANCELLATION_REASON='Invalid legacy/test check-in approved for audited cancellation'

psql "$DATABASE_URL" -X \
  -v target_row_id="$TARGET_ROW_ID" \
  -v employee_id="$EMPLOYEE_ID" \
  -v actor_employee_id="$ACTOR_EMPLOYEE_ID" \
  -f supabase/drafts/20260730_attendance_stale_cancellation_pre_run.sql \
  | tee attendance-cancellation-pre-run.txt
```

Review the retained pre-run output. Continue only when the exact target count
and employee open-row count are both `1`, settlement references are `0`, actor
checks pass, both provisional totals are `NULL` or exactly zero, and the grants
inventory contains only the intended authenticated `SELECT` grant.

```bash
psql "$DATABASE_URL" -X \
  -v target_row_id="$TARGET_ROW_ID" \
  -v employee_id="$EMPLOYEE_ID" \
  -v actor_employee_id="$ACTOR_EMPLOYEE_ID" \
  -v reason="$CANCELLATION_REASON" \
  -f supabase/drafts/20260730_attendance_stale_cancellation_forward.sql \
  | tee attendance-cancellation-forward.txt

psql "$DATABASE_URL" -X \
  -v target_row_id="$TARGET_ROW_ID" \
  -v employee_id="$EMPLOYEE_ID" \
  -v actor_employee_id="$ACTOR_EMPLOYEE_ID" \
  -f supabase/validation/20260730_attendance_stale_cancellation_post_run.sql \
  | tee attendance-cancellation-post-run.txt

psql "$DATABASE_URL" -X \
  -f supabase/validation/20260730_attendance_stale_cancellation_validation.sql \
  | tee attendance-cancellation-validation.txt
```

PASS requires the target to remain present with `check_out`, `total_hours`, and
`total_salary` all `NULL`; the original status preserved; exact actor/reason/timestamp
metadata; one `CANCELLED` audit event; zero open-target rows; zero settlement
references; zero invalid/forbidden result rows; and the immutable trigger in the
final inventory. A zero-valued legacy total is provisional input only and is
normalized to `NULL` by the same cancellation update so the cancelled row has
zero finalized contribution. The immutable cancellation event retains both
original provisional totals so an approved rollback can restore their exact
`NULL` or zero representation. Keep `ATTENDANCE_RECOVERY_ENABLED=false`
throughout this one-row package.

## Rollback sequence (only after an approved rollback decision)

Copy the exact `cancellation_audit_id` from retained post-run evidence. Rollback
will abort if the event/row does not match or was already rolled back.

```bash
export CANCELLATION_AUDIT_ID='<post-run-cancellation-audit-id>'
export ROLLBACK_REASON='Approved rollback of attendance cancellation'

psql "$DATABASE_URL" -X \
  -v target_row_id="$TARGET_ROW_ID" \
  -v employee_id="$EMPLOYEE_ID" \
  -v actor_employee_id="$ACTOR_EMPLOYEE_ID" \
  -v cancellation_audit_id="$CANCELLATION_AUDIT_ID" \
  -v rollback_reason="$ROLLBACK_REASON" \
  -f supabase/rollbacks/20260730_attendance_stale_cancellation_rollback.sql \
  | tee attendance-cancellation-rollback.txt

psql "$DATABASE_URL" -X \
  -v target_row_id="$TARGET_ROW_ID" \
  -v employee_id="$EMPLOYEE_ID" \
  -v actor_employee_id="$ACTOR_EMPLOYEE_ID" \
  -f supabase/validation/20260730_attendance_stale_cancellation_post_run.sql \
  | tee attendance-cancellation-rollback-post-run.txt
```

Rollback PASS requires the preserved status and open state to remain only
for the explicit target, cancellation metadata cleared, original provisional
totals restored exactly, and both immutable `CANCELLED` and
`ROLLBACK_RESTORED` events retained.
