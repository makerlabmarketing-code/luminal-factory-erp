# Validation Guide: Luminal Business Date and Time Policy

This guide is for implementation and review. It does not authorize a database
migration or historical data update.

## Prerequisites

- Node/npm dependencies installed from the repository lockfile.
- A working local environment for the existing Next.js application if manual
  UI traces are performed.
- No production or deployed-environment correctness is inferred.

## Static validation

Inspect available scripts first:

```bash
npm run
```

Run the repository-supported checks:

```bash
npm run lint
npm run build
```

Run the focused pure date tests through the required Vitest script:

```bash
npm test
```

## Pure regression scenarios

Verify at minimum:

1. An instant near UTC midnight derives the Vietnam calendar date.
2. Instants immediately before and after Vietnam local midnight derive
   adjacent dates.
3. Instants immediately before and after a local month boundary derive the
   correct business month.
4. A month range maps local `00:00:00` boundaries to UTC instants and uses
   `start <= instant < end` semantics.
5. The same cases pass with process `TZ=UTC` and another non-Vietnam timezone;
   browser timezone is never consulted.
6. `YYYY-MM-DD` round-trips as a calendar value without a day shift.
7. Invalid dates/months and malformed strings are rejected.

## Manual traces

Record the observed behavior and changed lines for:

- Staff Portal check-in/check-out and attendance history month filtering.
- Admin attendance month filtering, daily calendar selection, payroll month
  grouping, and payment-period label derivation.
- Staff expense month-period filtering and creation.
- Financial current-month period creation.
- Checkout reminder candidate selection and its cron caller.
- Check-in and check-out API routes, confirming instant writes and the
  unresolved `attendance`/`attendance_logs` relationship remain unchanged.
- Payroll duration/salary math, confirming it remains time-of-day duration math.

## Acceptance evidence

The implementation report must list exact commands and results, identify any
pre-existing lint/build blocker, list every ambiguous call site left unchanged,
and explicitly state that there was no migration, timestamp rewrite,
attendance source-of-truth decision, authentication redesign, payroll
settlement schema change, or workflow state-machine change.
