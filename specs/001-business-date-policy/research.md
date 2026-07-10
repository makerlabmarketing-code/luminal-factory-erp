# Research: Luminal Business Date and Time Policy

## Decision: use native `Intl.DateTimeFormat` with an explicit IANA timezone

The repository is Next.js 13 / TypeScript 5.2 and has no date-time runtime
dependency. The required contract is limited to extracting a calendar date or
month from an instant, validating date-only values, rolling a calendar month,
and converting local month boundaries into queryable UTC instants. Native
`Intl.DateTimeFormat` supports explicit `Asia/Ho_Chi_Minh` extraction in both
browser and server runtimes, so these operations do not require a date-time
library.

Local-boundary conversion must be isolated behind the utility. It must not use
`new Date(year, month, day)`, host-local getters, or a hard-coded `+07:00`
public contract. The implementation should construct a UTC candidate from the
calendar fields, obtain the named-zone offset by formatting that candidate with
`timeZone: 'Asia/Ho_Chi_Minh'`, and resolve/verify the resulting UTC boundary.
The utility tests must cover the actual boundary instants. The named IANA zone
remains the authority even though Vietnam currently has no DST transition.

## Decision: represent business calendar values as objects, not `Date`

`BusinessDate` is `{ year, month, day }` and `BusinessMonth` is `{ year,
month }`, both readonly and validated. A JavaScript `Date` is reserved for a
real instant or a query boundary. Existing `work_date` and `month_period`
database strings remain strings; the seam validates and serializes them rather
than parsing date-only strings as UTC timestamps.

## Decision: keep the seam narrow and dependency-light

No Luxon, date-fns, Day.js, Moment, Temporal polyfill, Supabase abstraction,
or broad date helper collection is justified by the audited call sites. The
utility exposes only instant-to-business-date/month, calendar input parsing and
serialization, month rollover/range construction, and date-only display
formatting needed by approved callers.

## Decision: add one dev-only executable test dependency

The current `package.json` has no `test` script and `package-lock.json` has no
Vitest entry. Pure regression coverage is required by the constitution and
feature specification. The smallest practical repository-compatible option is
one dev-only Vitest dependency plus a `test` script; it adds no production or
browser dependency. This is a test-only dependency, not a runtime date-time
library.

## Decision: date-only attendance queries remain calendar-string queries

`attendance.work_date` is used as a `YYYY-MM-DD` operational key. Approved
callers should compare canonical calendar strings and use `gte(start)` plus
`lt(nextMonthStart)` where the Supabase operator is compatible with the column.
This gives start-inclusive/end-exclusive semantics without converting the
date-only column to timestamp instants. Timestamp-column month queries, if
encountered during implementation, must use the UTC instants from the range
(`gte(queryStart)`, `lt(queryEnd)`).

## Decision: preserve ambiguous attendance behavior

`app/api/check-in/route.ts` writes `attendance_logs.check_in_time` as an ISO
instant. `app/api/attendance/check-out/route.ts` reads/writes the same instant
fields and computes elapsed duration. `services/attendanceService.ts` also
combines `work_date` and shift time for an overdue cutoff. These paths are
audited and documented, but unchanged because altering them could decide
attendance source of truth or overnight-shift semantics.
