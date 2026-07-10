# Implementation Call-Site Audit

This audit records the date/time classification used by the implementation.
It does not establish attendance source of truth, rewrite historical data, or
change any persisted timestamp.

## Approved for this feature

| Call site | Classification | Treatment |
|---|---|---|
| `services/financialService.ts#getCurrentMonthPeriod` | Operational month | Uses the business month contract and preserves `MM/YYYY`. |
| `app/staff/expenses/ExpensesView.tsx` | Operational month input/filter | Uses the business month for the current period; persisted labels remain strings. |
| `app/staff/attendance/AttendanceView.tsx` | Work date, month filter, date-only display | Uses business date/month values; `work_date` remains a date-only string and query bounds are `gte(start)`/`lt(nextMonth)`. |
| `app/admin/attendance/page.tsx` | Work-date grouping, calendar month, payroll payment-period label | Uses calendar values and business-month rollover; salary math and ledger schema remain unchanged. |
| `app/admin/attendance/components/DailyAttendanceModal.tsx` | Date-only display | Formats `YYYY-MM-DD` as a calendar value without `Date` parsing. |
| `services/emailService.ts#getCheckoutReminderCandidates` | Current operational work date | Uses the business date for `attendance.work_date`; email delivery and `sent_at` remain unchanged. |

`services/staffExpensesService.ts` was traced as a delegating caller. It uses
`getCurrentMonthPeriod()` and contains no duplicate date derivation.

## Leave unchanged

| Call site | Classification | Reason |
|---|---|---|
| `services/payrollService.ts#calculateHoursFromStrings` | Duration math | Synthetic date values calculate elapsed time between time-of-day strings; this is not a business-date derivation. |
| Staff Portal live clock and real-instant display formatting | Display formatting | It presents a real instant and is not authoritative operational date selection. |
| `app/admin/email-history/page.tsx#sent_at` | Instant display | `sent_at` remains a real event instant. |
| `app/api/payments/webhook/route.ts` date metadata | Payment event behavior | Payment persistence and event semantics are outside this approved feature. |
| Project target dates, dashboard year/sorting, and capital month flows | Ambiguous reporting/date meaning | Repository evidence does not establish the approved Luminal operational meaning for these flows. |

## Needs source-of-truth clarification

| Call site | Reason |
|---|---|
| `app/api/check-in/route.ts` | Writes `attendance_logs.check_in_time` as an ISO instant; changing it could establish `attendance_logs` as authoritative. |
| `app/api/attendance/check-out/route.ts` | Reads and updates `attendance_logs` instants and calculates elapsed duration; source relationship remains unresolved. |
| `services/attendanceService.ts#isAttendanceRecordOverdue` | Combines `work_date` with shift end time and may encode an unresolved overnight-shift policy. |
| Any attendance reconciliation or historical correction path | Attendance authority and historical interpretation are explicitly deferred. |

## Preserved boundaries

- `attendance.work_date` and `month_period` remain persisted strings.
- `attendance_logs` timestamps remain instants and are not rewritten.
- No database migration, authentication change, Supabase client redesign,
  payroll settlement schema change, or workflow state-machine change was made.
