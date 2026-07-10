# Implementation Plan: Luminal Business Date and Time Policy

**Branch**: `001-business-date-policy`  
**Date**: 2026-07-10  
**Spec**: [spec.md](./spec.md)

## Summary

Add one narrow, reusable business-calendar seam for `Asia/Ho_Chi_Minh` and
route only approved operational date/month interpretation through it. Keep
real timestamps as instants, date-only values as calendar strings, month ranges
start-inclusive/end-exclusive, and all business-date logic outside visual JSX.
The change is an application-code refactor with pure regression coverage; it
does not change storage or resolve ambiguous attendance authority.

## Current implementation observations

- Next.js 13 App Router, React 18, TypeScript 5.2 strict mode, Supabase, and
  Tailwind are present. `tsconfig.json` has `noEmit: true`, `moduleResolution:
  bundler`, and no test include/exclude convention.
- `package.json` has only `dev`, `build`, `start`, and `lint`; there is no test
  runner or date-time library. `npm run` confirmed this.
- `services/financialService.ts#getCurrentMonthPeriod()` uses host-local
  `getMonth()`/`getFullYear()` and emits the existing `MM/YYYY` string.
- `services/staffExpensesService.ts` delegates new `month_period` creation to
  that financial helper; the service itself needs no independent date logic.
- `app/staff/expenses/ExpensesView.tsx` derives its selected current period
  from a local `Date` and compares persisted month labels as strings.
- `app/staff/attendance/AttendanceView.tsx` uses local calendar construction
  for month bounds, local `toLocaleDateString` for today's `work_date`, and
  `new Date(work_date)` for date-only display. Its history query targets the
  date-only `attendance.work_date` column.
- `app/admin/attendance/page.tsx` parses `work_date` strings with `new Date()`
  for month filtering, constructs the visible calendar with host-local `Date`,
  and advances the payroll payment period with host-local month arithmetic.
- `app/admin/attendance/components/DailyAttendanceModal.tsx` parses a
  date-only string with `new Date()` for display.
- `services/emailService.ts#getCheckoutReminderCandidates()` derives today's
  candidate `work_date` via locale formatting without an explicit timezone;
  its cron caller is `app/api/cron/attendance-checkout-reminder/route.ts`.
- `services/payrollService.ts` uses a synthetic date only to calculate elapsed
  time between time-of-day strings. `services/attendanceService.ts` combines a
  date-only work date and shift end time for an overdue cutoff. Both require
  audit but are not automatically approved for change.
- `app/api/check-in/route.ts` and `app/api/attendance/check-out/route.ts` write
  and read `attendance_logs` instant timestamps. Their relationship to the
  `attendance` work-date records is unresolved.

## Approved call-site inventory

These are the only proposed behavior changes, subject to implementation-time
verification against the exact current lines:

| Call site | Change | Preserved |
|---|---|---|
| `services/financialService.ts` | Derive current business month from an instant and serialize existing `MM/YYYY`. | Currency helpers, format, and persistence contract. |
| `app/staff/expenses/ExpensesView.tsx` | Initialize current operational month from the seam; retain string filtering. | Expense UI, mutations, and stored labels. |
| `app/staff/attendance/AttendanceView.tsx` | Use business month/date helpers for current work date, date-only history bounds, and date-only display; use `gte(start)`/`lt(nextStart)` for calendar strings where supported. | Attendance table, check-in/out actions, time-of-day strings, shift behavior. |
| `app/admin/attendance/page.tsx` | Use calendar-value comparison for `work_date`, business month initialization, calendar-day helpers, and business-month payment-period rollover. | Payroll math, ledger writes, settlement category, UI flow, source records. |
| `app/admin/attendance/components/DailyAttendanceModal.tsx` | Display `YYYY-MM-DD` as a calendar value rather than parsing it as an instant. | Editing, times, and salary behavior. |
| `services/emailService.ts` | Derive current Luminal `work_date` for reminder candidates. | Email delivery, `sent_at` instants, candidate merge/filter logic, employee mapping. |

`services/staffExpensesService.ts` is an approved audit target because its
insert uses the financial helper, but it is not a proposed change. The cron
route is traced, not changed.

## Untouched and ambiguous call-site inventory

| Call site | Classification and reason |
|---|---|
| `app/api/check-in/route.ts` | **NEEDS SOURCE-OF-TRUTH CLARIFICATION**: preserves `attendance_logs.check_in_time` as an ISO instant; changing it could establish authority. |
| `app/api/attendance/check-out/route.ts` | **NEEDS SOURCE-OF-TRUTH CLARIFICATION**: preserves instant reads/writes and elapsed-duration behavior. |
| `services/attendanceService.ts#isAttendanceRecordOverdue` | **NEEDS SOURCE-OF-TRUTH CLARIFICATION**: date-plus-shift cutoff could encode overnight policy. |
| `services/payrollService.ts#calculateHoursFromStrings` | **LEAVE UNCHANGED**: synthetic date is duration arithmetic, not business-date derivation. |
| `AttendanceView` live clock/time formatting | **LEAVE UNCHANGED**: display-only formatting of a real instant. |
| `app/admin/email-history/page.tsx` `sent_at` formatting | **LEAVE UNCHANGED**: display-only instant formatting. |
| `app/api/payments/webhook/route.ts` ISO metadata date | **LEAVE UNCHANGED**: payment event behavior/storage semantics are outside scope. |
| `app/admin/projects/page.tsx`, dashboard year/sorting, and capital month handling | **LEAVE UNCHANGED**: current evidence does not establish approved Luminal operational-date/month meaning for these separate flows. |
| Any attendance reconciliation or historical correction | **NEEDS SOURCE-OF-TRUTH CLARIFICATION**: explicitly deferred. |

The required audit still reads `services/payrollService.ts`,
`services/attendanceService.ts`, both attendance API routes, and all listed
display/reporting paths. Audit does not authorize changing them.

## Proposed utility/domain boundary

Create `lib/business-date/index.ts` as the single browser/server-safe domain
boundary. It owns the timezone constant, validated calendar types, explicit
instant extraction, month arithmetic, serializers, date-only formatting, and
local-boundary-to-UTC conversion. Callers own operational intent, Supabase
access, and UI state. No business-date calculation remains inline in JSX.

Do not add a second Supabase client, change Server/Client boundaries, or create
a generic date abstraction.

## Conceptual API responsibilities

- `businessDateFromInstant(instant: Date | string): BusinessDate`
- `businessMonthFromInstant(instant: Date | string): BusinessMonth`
- `businessMonthFromDateInput(value: string): BusinessMonth`
- `businessDateFromDateInput(value: string): BusinessDate`
- `addBusinessMonths(month: BusinessMonth, amount: number): BusinessMonth`
- `businessMonthRange(month: BusinessMonth): BusinessMonthRange`, returning
  local calendar boundaries and UTC `queryStart`/`queryEnd` instants
- `businessMonthCalendar(month: BusinessMonth): { firstWeekday; daysInMonth }`
  for the existing admin calendar grid; this is pure calendar arithmetic, not
  a general date utility
- serializers for existing `YYYY-MM`, `YYYY-MM-DD`, and `MM/YYYY` contracts
- date-only display formatting from validated calendar fields

The public contract must not return business dates as `Date`, UTC midnight, or
browser-local objects. Do not add unobserved convenience helpers.

## TypeScript representation strategy

Use readonly explicit structural types:

```ts
type BusinessDate = Readonly<{ year: number; month: number; day: number }>;
type BusinessMonth = Readonly<{ year: number; month: number }>;
type BusinessMonthRange = Readonly<{
  localStart: BusinessDate;
  localEnd: BusinessDate;
  queryStart: Date;
  queryEnd: Date;
}>;
```

`Date` means an instant only, except for the returned query boundaries. Existing
database fields stay strings. Validate exact formats and impossible dates at
the utility boundary. Add no `any` or assertion used only to silence errors.

## Timezone implementation strategy

Use `Intl.DateTimeFormat`/`formatToParts` with an explicit
`timeZone: 'Asia/Ho_Chi_Minh'` for instant-to-calendar extraction. Never use
browser timezone, process timezone, `new Date(y, m, d)`, UTC-midnight encoding,
or numeric `+07:00` as the authoritative policy.

For a local midnight boundary, keep conversion in one utility function:
construct a UTC candidate from the calendar fields, derive the named-zone
offset with explicit-timezone formatting, calculate the UTC epoch, then
re-format and verify the candidate maps back to the requested local fields.
The algorithm must be deterministic for the fixed zone and covered at day and
month boundaries. Timestamp queries use `gte(queryStart)` and
`lt(queryEnd)`; date-only `work_date` queries use canonical string boundaries.

## Dependency decision

Do not add a runtime date-time library. Native `Intl` is sufficient for the
observed contract, and a library would add production bundle/dependency
surface without solving a demonstrated requirement. Because the current
repository has no executable test path, add exactly one dev-only test
dependency (Vitest) and a `test` script to execute strict TypeScript pure
regression tests. Vitest is not a runtime application dependency.

## Test strategy

Pure utility tests must cover:

- UTC/Vietnam date mismatch;
- immediately-before/after local midnight;
- immediately-before/after local month boundary;
- inclusive start/exclusive next-month end and expected UTC boundaries;
- invariance under `TZ=UTC` and a non-Vietnam process timezone;
- no browser timezone access;
- date-only parse/serialize without day shift;
- invalid date/month/input rejection;
- existing `MM/YYYY` serialization;
- month rollover used for payroll payment labels.

Call-site tests should remain narrow. Manually trace check-in/check-out instant
writes, attendance source relationship, reminder selection, payroll duration
math, and expense/financial month handling. Do not convert manual trace claims
into deployed correctness claims.

## File-by-file change plan

| File | Why it changes | Responsibility added/removed | Intentional behavior | Preserved behavior |
|---|---|---|---|---|
| `lib/business-date/index.ts` (new) | Establish the authoritative seam. | Adds calendar types, timezone operations, validation, serialization, and boundary conversion. | Approved derivations become independent of host/browser timezone. | No persistence, IDs, or source records change. |
| `lib/business-date/index.test.ts` (new) | Protect pure date calculations. | Adds executable boundary and timezone-invariance regression coverage. | Makes incorrect boundary assumptions fail tests. | No application workflow changes. |
| `package.json` | Expose executable pure tests; the repository currently has no test script. | Adds Vitest as a dev dependency and a `test` script. | Enables regression execution. | No runtime dependency or production script behavior. |
| `package-lock.json` | Keep the dependency graph reproducible. | Records the Vitest dev dependency graph. | None at runtime. | Existing locked application graph otherwise preserved. |
| `services/financialService.ts` | Current operational month is approved. | Replaces host-local month extraction with business-month serialization. | New current period follows Luminal month. | Existing `MM/YYYY`, currency behavior, and records. |
| `app/staff/expenses/ExpensesView.tsx` | Selected month is approved operational period. | Uses business-month current-period derivation. | Boundary month selection is timezone-independent. | String comparison, UI, and mutations. |
| `app/staff/attendance/AttendanceView.tsx` | Work date, history month, and date-only display are approved. | Uses business calendar values/ranges outside JSX. | Corrects date/month boundary interpretation. | Source table, actions, shifts, times, and payload shapes. |
| `app/admin/attendance/page.tsx` | Admin filtering/calendar/payroll period are approved. | Uses calendar-value predicates and month rollover. | Corrects month grouping and period labels. | Payroll math, ledger schema, settlement flow. |
| `app/admin/attendance/components/DailyAttendanceModal.tsx` | Date-only display currently parses an instant. | Adds calendar-value display responsibility. | Prevents date display shifts. | Editing and salary behavior. |
| `services/emailService.ts` | Reminder candidate date is approved. | Uses explicit current business date. | Candidate selection follows Luminal day. | Delivery, sent timestamps, merge/filter rules. |
| `specs/001-business-date-policy/call-site-audit.md` | Preserve the required implementation-time classification record. | Records approved, unchanged, and source-of-truth-sensitive paths. | None. | Existing application behavior and scope boundaries. |

No change is proposed to `services/staffExpensesService.ts` unless audit finds
duplicated logic; its delegation must be documented. No change is proposed to
the cron route or ambiguous/API paths.

## Migration impact

No database migration. No column/type/format change. No historical timestamp
rewrite or date correction. Existing `work_date`, `month_period`, instant
timestamps, relationships, and source records remain as stored.

## Rollout risk

Boundary-visible behavior may change where host-local behavior was accidental,
especially near UTC/Vietnam midnight and month rollover. Mitigate with pure
boundary tests, a call-site diff review, and manual traces. The highest-risk
regression is broadening into attendance authority or overnight policy; the
untouched inventory is a release gate. Historical values must not be declared
correct merely because new derivation is explicit.

## Validation commands

Confirmed available before implementation: `npm run`, `npm run lint`, and
`npm run build`. After the test path is added, run:

```bash
npm run lint
npm run build
npm test
```

Also perform the manual traces in [quickstart.md](./quickstart.md), report
exact results, and do not claim deployed RLS or environment correctness.

## Rollback considerations

Rollback is a source-only revert of the utility and approved imports. No data
rollback is needed because there is no migration or rewrite. Keep the audit
and ambiguous-call-site documentation when reverting behavior.

## Explicit non-changes

- no database migration
- no historical timestamp rewrite
- no attendance source-of-truth decision
- no payroll settlement schema change
- no authentication redesign
- no workflow state-machine change
- no Supabase client architecture redesign

## Constitution Check

- **Operational correctness / attendance / payroll**: explicit Vietnam calendar
  interpretation is applied only to approved work-date and month call sites;
  real event timestamps and payroll math remain intact.
- **Brownfield development**: current callers, services, routes, queries,
  side effects, and ambiguous paths are inventoried before the seam is used.
- **Domain boundaries and stable relationships**: no source record, employee
  identifier, ledger relationship, or workflow state changes.
- **Server-first / outside JSX**: pure calendar logic lives in the utility;
  client components retain interaction and presentation responsibilities.
- **Supabase/authorization**: no client, RLS, auth, environment, or trusted
  server boundary changes.
- **Strict TypeScript / critical calculations**: readonly domain values,
  validated inputs, no new `any`, and pure regression seams are required.
- **Validation**: commands are based on the actual scripts; manual attendance,
  payroll, finance, and reminder traces are required.

No constitution violation or complexity exception is required.

## Required explicit scope statements

This plan introduces no database migration, no historical timestamp rewrite, no
attendance source-of-truth decision, no payroll settlement schema change, no
authentication redesign, and no workflow state-machine change.

PLAN READY FOR TASKS
