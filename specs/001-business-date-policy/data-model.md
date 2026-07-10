# Data Model: Luminal Business Date and Time Policy

This feature adds no database entities, columns, migrations, or storage-format
changes. The following are application-domain values only.

| Value | Representation | Meaning |
|---|---|---|
| `BusinessTimeZone` | constant string `Asia/Ho_Chi_Minh` | Authoritative Luminal operational timezone |
| `BusinessDate` | readonly `{ year: number; month: number; day: number }` | Date-only Vietnam calendar value; never an instant |
| `BusinessMonth` | readonly `{ year: number; month: number }` | Operational calendar month; never a runtime-local month object |
| `BusinessMonthRange` | readonly local start/end calendar values plus `queryStart`/`queryEnd` `Date` instants | Local start-inclusive, next-local-month end-exclusive range |
| Real event timestamp | existing ISO/database timestamp string, read as an instant | Check-in, check-out, created, updated, settled, and sent evidence |
| Date-only operational value | existing `YYYY-MM-DD` string | `attendance.work_date` and similar calendar values; never UTC-midnight parsing |
| Operational month label | existing `MM/YYYY` string | Existing expense/financial/payroll period contract |

Validation rules:

- months are 1 through 12;
- days are valid for the supplied year and month;
- input strings must match their intended canonical format before conversion;
- invalid instants and malformed calendar values fail explicitly;
- business dates/months are not converted to JavaScript `Date` values;
- existing persisted values and identifiers remain unchanged.

No relationships or state transitions are introduced. Attendance source of
truth, overnight shifts, payroll settlement schema, and historical correction
remain deferred.

