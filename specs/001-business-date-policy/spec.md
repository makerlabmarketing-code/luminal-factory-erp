# Feature Specification: Luminal Business Date and Time Policy

**Feature Branch**: `[001-business-date-policy]`

**Created**: 2026-07-10

**Status**: Draft

**Input**: User description: "Create the first focused feature specification for the Luminal Factory ERP. Feature working title: Luminal Business Date and Time Policy. This is a brownfield correctness feature for explicit Asia/Ho_Chi_Minh business-date and business-month interpretation. Do not implement anything, do not create a database migration, and do not redesign attendance, payroll, authentication, Supabase architecture, or production workflow."

## Purpose

Define a small, explicit business-date contract for Luminal Factory ERP so attendance work dates, payroll work dates, operational months, expense periods, daily summaries, and intended Luminal date filters are interpreted using the Luminal Factory business calendar in Vietnam.

This specification exists to reduce timezone ambiguity before later attendance source-of-truth, payroll settlement, and workflow specifications are created. It establishes what the ERP must mean by a Luminal business date or month, and requires implementation-time audit and documentation of date handling without changing ambiguous business flows.

## Business Context

Luminal Factory operates in Vietnam. The authoritative operational business timezone is `Asia/Ho_Chi_Minh`.

Database timestamps may represent real instants in UTC. Real event timestamps, such as check-in timestamp, check-out timestamp, created timestamp, updated timestamp, settled timestamp, and sent timestamp, must preserve instant semantics. The feature must not convert persisted event instants into naive local timestamps merely to satisfy display or filtering behavior.

Attendance work dates, payroll work dates, payroll month periods, Luminal operational expense month periods, daily operational summaries, and business date or month filters must use the Luminal Factory calendar day or month in `Asia/Ho_Chi_Minh`. Browser timezone and server runtime local timezone must not determine authoritative operational dates.

The relationship between `attendance` and `attendance_logs` remains unknown. This feature must not decide which table or flow is authoritative for attendance. Call sites whose date meaning or source-of-truth relationship is ambiguous must be documented and left unchanged.

## Clarifications

### Session 2026-07-10

- Q: What domain representation should a Luminal business date expose conceptually? -> A: A Luminal business date is a date-only operational calendar value with year, month, and day fields in `Asia/Ho_Chi_Minh`; it is not a JavaScript `Date`, timestamp, UTC midnight instant, or browser-local date object. This resolves FR-002, FR-008, AC-002, AC-003, and User Story 1.
- Q: Which conceptual operations are required by this feature? -> A: The required contract covers only observed operational needs: derive a Luminal business date from an instant, derive Luminal business year and month, derive a Luminal business month range, and convert Luminal local calendar boundaries to queryable UTC instant boundaries. Convenience helpers without observed call-site need remain out of scope. This resolves FR-008, FR-011, FR-012, AC-004, AC-005, and User Story 2.
- Q: Which audited call sites have sufficiently clear business meaning to include? -> A: Approved call sites are limited to clear Luminal date or month interpretation in current month-period creation, attendance work-date derivation and filtering, admin attendance month filtering, payroll month summary grouping, and checkout reminder candidate work-date selection. Pure instant logging, duration math, display-only formatting, and `attendance_logs` source-of-truth behavior are left unchanged or deferred. This resolves FR-013 through FR-020, AC-009, AC-010, and User Stories 4 and 5.
- Q: How should persisted date-only strings be treated? -> A: Date-only operational strings must be treated as Luminal calendar values and must not be parsed as UTC timestamps without repository evidence; timestamp fields remain instants; ambiguous strings must be documented and left unchanged. This resolves FR-004, FR-005, FR-008, AC-006, AC-007, and User Story 3.
- Q: How should month range queries define inclusivity? -> A: Luminal operational month ranges use start inclusive and end exclusive boundaries. The local Luminal start boundary is included, the next local month boundary is excluded, and timestamp queries must use the corresponding UTC instants. This resolves FR-011, FR-012, AC-005, AC-012, and User Story 2.
- Q: What timezone behavior must be regression-tested independently of host process timezone? -> A: Deriving business dates, deriving business months, building local-boundary-to-UTC ranges, handling persisted date-only strings, and classifying approved call sites must produce the same results when browser or runtime timezone differs. This resolves AC-011, AC-012, SC-001, SC-002, SC-003, and Validation Expectations.
- Q: Which unresolved questions belong to later specifications? -> A: Attendance source of truth, overnight-shift policy, payroll settlement schema, historical data correction, and final payroll calculation policy remain deferred to later attendance or payroll specifications. This preserves explicit non-goals and resolves the scope boundary for User Stories 3, 4, and 5.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Interpret Work Dates in Vietnam (Priority: P1)

As an operator reviewing attendance or payroll, I need operational work dates to follow the Luminal Factory calendar in Vietnam even when the underlying event instant has a different UTC calendar date.

**Why this priority**: Attendance integrity and payroll correctness depend on the work date being the date Luminal Factory actually operated, not the date implied by UTC, the browser, or the server runtime.

**Independent Test**: Can be tested with event instants near UTC and Vietnam day boundaries and by verifying that the derived operational work date is the Vietnam calendar date.

**Acceptance Scenarios**:

1. **Given** an event instant whose UTC calendar date differs from the `Asia/Ho_Chi_Minh` calendar date, **When** the ERP derives an operational work date at an approved call site, **Then** the result is the Vietnam calendar date.
2. **Given** the same event instant evaluated from a browser configured outside Vietnam, **When** the ERP derives an operational work date at an approved call site, **Then** the result is unchanged.
3. **Given** the same event instant evaluated in a server runtime configured outside Vietnam, **When** the ERP derives an operational work date at an approved call site, **Then** the result is unchanged.

---

### User Story 2 - Interpret Operational Months in Vietnam (Priority: P1)

As an admin reviewing attendance, payroll, expenses, or operational summaries by month, I need month periods to follow Luminal Factory calendar month boundaries.

**Why this priority**: Payroll periods and monthly operational summaries can be materially wrong when records near midnight UTC or month boundaries are grouped by the wrong calendar.

**Independent Test**: Can be tested with instants near Luminal month transitions and by verifying that approved operational month calculations use Vietnam calendar month boundaries while timestamp range queries use the corresponding real instants.

**Acceptance Scenarios**:

1. **Given** an event instant near the transition between two Luminal calendar months, **When** the ERP classifies the event for an approved operational month calculation, **Then** the event belongs to the month determined by `Asia/Ho_Chi_Minh`.
2. **Given** an approved feature filters timestamp records for a Luminal operational month, **When** month boundaries are evaluated, **Then** the local Luminal month start is included, the next local month start is excluded, and the corresponding query range uses real UTC instants.
3. **Given** a persisted month period that already represents a Luminal operational month, **When** the ERP creates or compares month labels, **Then** the label reflects the Luminal business month and not the browser or server local month.

---

### User Story 3 - Preserve Event Instants and Historical Records (Priority: P2)

As an admin or auditor, I need existing timestamps to remain unchanged while the ERP becomes explicit about when and where operational business dates are derived.

**Why this priority**: Historical records must remain interpretable. Fixing date interpretation must not silently rewrite source evidence or imply that past data was already timezone-correct.

**Independent Test**: Can be tested by verifying that no database migration or historical timestamp rewrite is introduced, and that event timestamps remain treated as real instants.

**Acceptance Scenarios**:

1. **Given** an existing timestamp record, **When** this feature is implemented, **Then** the stored timestamp is not rewritten.
2. **Given** a real event timestamp such as check-in, check-out, created, updated, settled, or sent time, **When** the ERP stores or reads the timestamp, **Then** the timestamp continues to represent a real instant.
3. **Given** a historical timestamp that may have been interpreted inconsistently before this feature, **When** an approved call site derives an operational business date from it, **Then** the explicit Luminal timezone policy is used without claiming historical data was previously correct.

---

### User Story 4 - Document Ambiguous Attendance Flows (Priority: P2)

As a maintainer preparing future attendance and payroll specifications, I need ambiguous attendance date calculations to be visible without deciding whether `attendance` or `attendance_logs` is authoritative.

**Why this priority**: The repository currently contains attendance flows that use both work-date records and event-log records. Choosing a source of truth in this feature would exceed scope and create hidden payroll risk.

**Independent Test**: Can be tested by tracing check-in and check-out flows and verifying that ambiguous source-of-truth behavior is documented and left unchanged.

**Acceptance Scenarios**:

1. **Given** a date calculation inside a flow whose relationship between `attendance` and `attendance_logs` is unclear, **When** implementation evaluates the call site, **Then** the business behavior is left unchanged and the unresolved call site is documented.
2. **Given** check-in and check-out API routes that write or update `attendance_logs`, **When** implementation performs the required manual trace, **Then** the trace documents current date and timestamp behavior without establishing `attendance_logs` as the source of truth.
3. **Given** Staff Portal attendance behavior that uses `attendance.work_date`, **When** implementation changes an approved unambiguous business-date derivation, **Then** the change does not alter the unresolved relationship between `attendance` and `attendance_logs`.

---

### User Story 5 - Keep Non-Date Behavior Stable (Priority: P3)

As staff and admins, I need attendance, payroll, finance, and reminder behavior outside approved date interpretation changes to remain unchanged.

**Why this priority**: This is a brownfield correctness feature. It must improve one explicit seam without redesigning adjacent workflows.

**Independent Test**: Can be tested through manual traces of the named workflows and by comparing behavior outside date and month interpretation before and after implementation.

**Acceptance Scenarios**:

1. **Given** attendance, payroll, finance, or reminder behavior that does not derive an authoritative Luminal business date or business month, **When** this feature is implemented, **Then** that behavior remains unchanged.
2. **Given** payroll calculations that derive totals from current attendance inputs, **When** month interpretation is standardized at approved call sites, **Then** payroll calculation rules and settlement schema remain unchanged.
3. **Given** expense or finance records, **When** month-period interpretation is standardized only where it clearly represents a Luminal operational month, **Then** financial aggregation and authoritative source records are not redesigned.

### Edge Cases

- An event occurs between 17:00:00 UTC and 16:59:59 UTC around a UTC/Vietnam date mismatch, causing UTC and Luminal calendar dates to differ.
- An event occurs immediately before or after local `00:00:00` in `Asia/Ho_Chi_Minh`.
- An event occurs immediately before or after the first local instant of a Luminal calendar month.
- A staff member uses a browser configured to a timezone outside Vietnam.
- The server runtime uses UTC or another local timezone.
- A business date is stored as a date-only value and must be displayed or compared without shifting to the previous or next day.
- A timestamp is stored as a real instant and must not be converted into a naive local timestamp for persistence.
- A date-only operational string is already persisted and must not be reinterpreted as UTC midnight unless repository evidence proves that is the intended storage meaning.
- A string resembles a date or month but its operational meaning is unclear.
- A month-period value represents a Luminal operational month in one flow but a different non-operational reporting convention in another flow.
- A date calculation is found in a flow where the relationship between `attendance` and `attendance_logs` is unclear.
- Existing historical records may already contain inconsistent interpretations and must not be rewritten or retroactively declared correct.

## Operational Governance *(mandatory for ERP changes)*

**Operational Area**: Attendance, payroll, expenses, finance, Staff Portal, admin attendance filtering, operational summaries, and reminder logic where the intended date or month is a Luminal Factory operational calendar date or month.

**Authoritative Source Records**: This feature does not decide final source-of-truth records. Existing source records include attendance work-date records, attendance log event records, payroll inputs derived from attendance, financial ledger records, expense records, email history, and operational settings where currently used. Real event timestamps remain source evidence as instants. Business dates and business months are derived or compared values unless already persisted by existing records. Persisted date-only operational strings are Luminal calendar values, not UTC timestamp values, unless repository evidence proves otherwise.

**Stable Identifiers**: The feature does not introduce or change persisted relationships. Existing stable identifiers, such as employee identifiers used by attendance, payroll, finance, and reminders, must remain stable. Display names remain presentation values and must not become new durable relationship keys as part of this feature.

**Business Calculations**: The feature governs timezone and day-boundary assumptions for attendance work dates, payroll work dates, payroll month periods, Luminal operational expense month periods, daily summaries, and date or month filters. A Luminal business date is the local calendar date in `Asia/Ho_Chi_Minh` represented conceptually as year, month, and day fields, not as an instant. A business day currently runs from local `00:00:00` through the instant immediately before the next local `00:00:00`. A Luminal operational month range is start inclusive and end exclusive. Payroll calculation rules, worked-hours rounding rules, financial aggregation rules, and reminder delivery rules are not redesigned.

**Approved Call-Site Classification**:

- **APPROVED FOR THIS FEATURE**: `services/financialService.ts` current operational month-period creation; `services/staffExpensesService.ts` staff expense `month_period` creation through the current month-period contract; Staff Portal expense month filtering when it compares `month_period` as an operational month; Staff Portal attendance current work-date derivation, attendance history month boundaries, and work-date display where the value is date-only; admin attendance month filtering, calendar day construction, daily modal date selection, payroll month summary grouping, and payroll payment-period month label derivation where they operate on `attendance.work_date` or operational month labels; checkout reminder candidate work-date selection in `services/emailService.ts`.
- **LEAVE UNCHANGED**: `services/payrollService.ts` duration and salary math that operates on time-of-day strings rather than deriving a business date; real instant logging such as email `sent_at`, check-in `check_in_time`, and check-out `check_out_time`; display-only formatting of real instants; currency parsing or formatting; non-date behavior in attendance, payroll, finance, expense, and reminder flows.
- **NEEDS SOURCE-OF-TRUTH CLARIFICATION**: `app/api/check-in/route.ts` and `app/api/attendance/check-out/route.ts` behavior that writes or updates `attendance_logs`; any logic whose change would imply that `attendance_logs` or `attendance` is authoritative; any historical correction path for records derived under previous timezone assumptions.

**Authorization Boundary**: This feature does not change authentication, authorization, role ownership, RLS, trusted server boundaries, or Supabase client architecture. Actual deployed RLS and environment variables remain externally unverified.

**History and Traceability**: Existing persisted timestamps and historical records must remain unchanged. Implementation must document ambiguous date call sites it leaves unchanged. The spec must not claim historical data is already timezone-correct.

**ERP/Storefront Boundary**: This is ERP-owned operational correctness work. It must not introduce storefront visual behavior, storefront motion, or customer-facing commerce behavior.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The ERP MUST have one documented authoritative business timezone contract representing `Asia/Ho_Chi_Minh`.
- **FR-002**: The ERP MUST define a Luminal business date as the local calendar date in `Asia/Ho_Chi_Minh`.
- **FR-003**: The ERP MUST define the current Luminal business day as local `00:00:00` in `Asia/Ho_Chi_Minh` through the instant immediately before the next local `00:00:00`.
- **FR-004**: The ERP MUST preserve real event timestamps as instants for records such as check-in, check-out, created, updated, settled, and sent timestamps.
- **FR-005**: The ERP MUST NOT rewrite historical timestamps or existing persisted business-date values as part of this feature.
- **FR-006**: The ERP MUST NOT introduce a database migration as part of this feature.
- **FR-007**: The ERP MUST NOT decide whether `attendance` or `attendance_logs` is authoritative.
- **FR-008**: When an approved call site derives an operational business date from an instant, it MUST derive the date using `Asia/Ho_Chi_Minh`.
- **FR-009**: Approved business-date derivation MUST NOT depend on browser local timezone.
- **FR-010**: Approved business-date derivation MUST NOT depend on server runtime local timezone.
- **FR-011**: Approved operational month calculations MUST use Luminal calendar month boundaries in `Asia/Ho_Chi_Minh`.
- **FR-012**: The implementation plan MUST distinguish Luminal local month boundaries from the real instants used to query timestamp ranges.
- **FR-013**: The feature MUST apply the business-date contract only to existing call sites whose current business meaning is already clear.
- **FR-014**: The feature MUST document ambiguous date call sites found during implementation and leave their business behavior unchanged.
- **FR-015**: The implementation-time usage audit MUST include `services/financialService.ts`, `services/payrollService.ts`, `services/attendanceService.ts`, `app/staff/attendance/AttendanceView.tsx`, `app/admin/attendance/page.tsx`, and `services/emailService.ts`.
- **FR-016**: The implementation-time usage audit MUST inspect `app/api/check-in/route.ts` and `app/api/attendance/check-out/route.ts` without automatically changing them.
- **FR-017**: Additional call sites MAY be included only when repository evidence shows that they derive an authoritative Luminal business date or business month.
- **FR-018**: Payroll scope MUST be limited to work-date and payroll-month interpretation; payroll calculation rules and payroll settlement schema MUST remain unchanged.
- **FR-019**: Finance and expense scope MUST be limited to date or month logic that clearly represents a Luminal operational calendar period.
- **FR-020**: Reminder or notification date logic MAY be included only where the intended date is clearly a Luminal operational business date.
- **FR-021**: The feature MUST preserve behavior outside explicitly approved business-date and business-month interpretation changes.
- **FR-022**: The specification and later implementation plan MUST avoid choosing a date-time library before technical planning.
- **FR-023**: Validation reporting MUST remain factual and MUST NOT claim deployed correctness, deployed RLS correctness, or deployed environment correctness.
- **FR-024**: A Luminal business date MUST be represented conceptually as a date-only operational value with year, month, and day in the Luminal business timezone, not as a JavaScript `Date`, UTC midnight instant, or browser-local date object.
- **FR-025**: A Luminal business month MUST be represented conceptually as year and month in the Luminal business timezone, not as a runtime-local month derived from an instant.
- **FR-026**: The business-date contract MUST support only these conceptual operations unless technical planning finds an approved call-site need: derive Luminal business date from an instant, derive Luminal business year and month, derive Luminal business month range, and convert Luminal local calendar boundaries to queryable UTC instant boundaries.
- **FR-027**: Operational month ranges MUST be modeled as start inclusive and end exclusive.
- **FR-028**: Persisted date-only operational values MUST be compared and displayed as Luminal calendar values and MUST NOT be reinterpreted as UTC timestamps without repository evidence.
- **FR-029**: Ambiguous strings that might be dates or months MUST be documented and left unchanged unless repository evidence establishes their Luminal operational meaning.
- **FR-030**: Implementation MUST classify audited date and time call sites as `APPROVED FOR THIS FEATURE`, `LEAVE UNCHANGED`, or `NEEDS SOURCE-OF-TRUTH CLARIFICATION`.

### Key Entities *(include if feature involves data)*

- **Luminal Business Timezone**: The authoritative operational timezone for Luminal Factory, fixed by this feature as `Asia/Ho_Chi_Minh`.
- **Luminal Business Date**: A date-only operational calendar value interpreted in the Luminal business timezone and represented conceptually by year, month, and day fields. It is not an instant.
- **Luminal Business Month**: A calendar month interpreted in the Luminal business timezone and represented conceptually by year and month fields. It is used only where a feature clearly means a Luminal operational month.
- **Luminal Business Month Range**: A local Luminal calendar range with an inclusive start boundary and exclusive end boundary.
- **Queryable UTC Instant Range**: The real instant range corresponding to Luminal local calendar boundaries when timestamp fields must be queried.
- **Real Event Timestamp**: A timestamp representing an actual instant, such as check-in, check-out, created, updated, settled, or sent time.
- **Date-Only Operational Value**: A persisted or derived string value that represents a Luminal calendar date without a time-of-day or instant.
- **Ambiguous Date String**: A string that resembles a date or month but lacks repository evidence proving whether it is an instant, a Luminal calendar value, or another reporting label.
- **Approved Date Call Site**: An existing call site whose current business meaning clearly requires a Luminal operational date or month and is safe to standardize without redesigning adjacent behavior.
- **Ambiguous Date Call Site**: A call site whose date meaning, source record, or source-of-truth relationship is unclear and therefore must be documented and left unchanged.

## Acceptance Criteria

- **AC-001**: The repository has one documented authoritative business timezone constant or contract representing `Asia/Ho_Chi_Minh`.
- **AC-002**: Business-date derivation does not depend on browser local timezone at approved call sites.
- **AC-003**: Business-date derivation does not depend on server runtime local timezone at approved call sites.
- **AC-004**: Approved operational date call sites derive dates using the Luminal business timezone.
- **AC-005**: Approved operational month calculations use Luminal calendar month boundaries.
- **AC-006**: Real event timestamps preserve instant semantics.
- **AC-007**: No historical timestamp rewrite occurs.
- **AC-008**: No database migration is introduced.
- **AC-009**: No attendance source-of-truth decision is introduced.
- **AC-010**: Ambiguous date call sites identified during implementation are documented and left unchanged.
- **AC-011**: Behavior is validated around UTC and Luminal calendar-day boundaries.
- **AC-012**: Behavior is validated around Luminal calendar-month boundaries.
- **AC-013**: Relevant existing attendance, payroll, finance, and reminder behavior outside approved date interpretation changes remains unchanged.
- **AC-014**: Luminal business dates and months are specified and validated as calendar values, not JavaScript `Date` instants.
- **AC-015**: Persisted date-only operational values are not parsed or shifted as UTC timestamps at approved call sites.
- **AC-016**: Operational month ranges use start inclusive and end exclusive boundaries.
- **AC-017**: Audited call sites are classified as `APPROVED FOR THIS FEATURE`, `LEAVE UNCHANGED`, or `NEEDS SOURCE-OF-TRUTH CLARIFICATION`.

## Validation Expectations

- Unit-level validation for business-date derivation around UTC and Vietnam day boundaries.
- Unit-level validation for Luminal month boundaries.
- Validation that derived results do not change when simulated browser timezone differs.
- Validation that derived results do not change when simulated runtime timezone differs.
- Validation that Luminal business date derivation from the same instant is stable when host process timezone differs.
- Validation that Luminal business month derivation from the same instant is stable when host process timezone differs.
- Validation that Luminal local month boundaries convert to the same queryable UTC instant range when host process timezone differs.
- Validation that persisted date-only operational values do not shift calendar date when host process timezone differs.
- Validation that timestamp or instant fields continue to behave as real instants.
- Manual trace of the current check-in flow.
- Manual trace of the current check-out flow.
- Manual trace of admin attendance month filtering.
- Manual trace of payroll month summary.
- Manual trace of expense month-period handling.
- Manual trace of checkout reminder candidate-date logic when present.
- `npm run lint`.
- `npm run build` when no unrelated existing build blocker prevents it.

Validation reports must state exactly what was run and what passed or failed. They must not claim deployed correctness. Actual Supabase RLS and deployed environment variables remain externally unverified.

## Explicit Non-Goals

- Decide whether `attendance` or `attendance_logs` is authoritative.
- Create an overnight-shift policy.
- Redesign attendance.
- Redesign payroll.
- Create a payroll settlement schema.
- Migrate financial ledger employee relationships.
- Redesign Staff Portal authentication.
- Change production workflow statuses.
- Define the final workflow state machine.
- Redesign Supabase client architecture.
- Claim deployed RLS correctness.
- Claim deployed environment correctness.
- Migrate the database.
- Rewrite historical timestamps.
- Introduce storefront visual or motion behavior.
- Perform broad component decomposition.
- Redesign financial aggregation.
- Change authoritative financial source records.
- Redesign email delivery or notification architecture.
- Choose a date-time library before technical planning.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of approved operational business-date derivations covered by this feature produce the same date regardless of browser timezone.
- **SC-002**: 100% of approved operational business-date derivations covered by this feature produce the same date regardless of server runtime local timezone.
- **SC-003**: Boundary validation covers at least one UTC/Vietnam date mismatch, one Luminal day boundary, and one Luminal month boundary.
- **SC-004**: The required implementation-time usage audit covers all six required files and both inspect-only API routes.
- **SC-005**: Every ambiguous date call site found during implementation is listed with the reason it was left unchanged.
- **SC-006**: Zero database migrations are introduced by this feature.
- **SC-007**: Zero historical timestamp rewrite operations are introduced by this feature.
- **SC-008**: Manual traces confirm that check-in, check-out, admin attendance month filtering, payroll month summary, expense month-period handling, and checkout reminder candidate-date behavior were reviewed factually.

## Assumptions

- Luminal Factory's operational business timezone is fixed as `Asia/Ho_Chi_Minh` for this feature.
- Vietnam currently has no daylight saving time, but the policy still names the timezone rather than a numeric UTC offset.
- Date-only attendance work dates and month-period labels are business calendar values, not event instants.
- A value in `YYYY-MM-DD` form is not automatically an instant. It is treated as a Luminal date-only operational value when current repository usage shows it is an operational work date.
- A value in `MM/YYYY` form is not automatically a runtime-local month. It is treated as a Luminal operational month only when current repository usage shows it is an operational month period.
- Existing persisted data may include historical timezone ambiguity.
- Existing data storage formats remain unchanged for this feature.
- Existing authentication, authorization, Supabase client architecture, attendance flows, payroll rules, financial source records, and notification delivery architecture remain in place.
- The current user-approved scope is specification only; implementation planning, tasks, migrations, and application-code changes are out of scope for this command.

## Unresolved Questions

- Later attendance specification: Which attendance source or combination of sources will become authoritative: `attendance`, `attendance_logs`, or a later reconciled model?
- Later data-correction or audit specification: Which historical records, if any, were previously derived using browser local time, Node runtime local time, UTC date parts, or inconsistent conversion behavior?
- Later finance specification: Which finance and expense month-period values are strictly Luminal operational months versus other reporting labels?
- Later attendance specification: Should an overnight-shift policy be defined, and if so, what operational rule should replace the current local calendar-day boundary?
- Later payroll specification: What final payroll settlement schema and snapshot policy should formal settlement use beyond the existing approved principle of derived before settlement and snapshot after formal settlement?
- Which date-time library, platform API, or internal utility shape should be chosen during technical planning?
- What deployed runtime timezone, browser timezone mix, Supabase column types, RLS policies, and environment variables are actually present in production?
