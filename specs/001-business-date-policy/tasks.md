---

description: "Implementation tasks for Luminal Business Date and Time Policy"

---

# Tasks: Luminal Business Date and Time Policy

**Input**: Design documents in `/specs/001-business-date-policy/`

**Prerequisites**: `spec.md`, `plan.md`, `research.md`, `data-model.md`, and
`quickstart.md`. No external contracts are required because this is an
internal ERP domain seam.

**Implementation constraint**: Tasks must preserve persisted timestamps and
date-only values, avoid database changes, leave ambiguous attendance flows
unchanged, and keep business-date logic outside JSX.

## Phase 1: Setup

**Purpose**: Establish the smallest executable regression path and record the
baseline needed for safe brownfield changes.

- [X] T001 Inspect current package scripts, TypeScript configuration, dependency lockfile, and existing date/time call sites before implementation in `package.json`, `package-lock.json`, `tsconfig.json`, `services/`, `app/`, and `lib/`.
  - Objective: Confirm the implementation baseline and prevent assumptions about test, lint, build, or timezone behavior.
  - Dependency: None.
  - Completion criteria: Baseline scripts, current test capability, and all required audit files/routes are recorded; no application files are changed by this task.
  - Validation: Run `npm run`; record available scripts and confirm no database migration or date-time runtime dependency is introduced.

- [X] T002 Add the minimal pure-test capability in `package.json` and `package-lock.json`.
  - Objective: Make constitution-required business-date regression tests executable with one dev-only Vitest dependency and a `test` script.
  - Dependency: T001.
  - Completion criteria: Vitest is dev-only, `npm test` targets the focused test files, and production dependencies/scripts are otherwise unchanged.
  - Validation: Run `npm install` or the repository-approved lockfile update procedure, then run the new test command against a temporary or initial passing test configuration.

## Phase 2: Foundational Business-Date Seam

**Purpose**: Create the shared contract and pure calculations before migrating
any application call site.

- [X] T003 Define the validated business-calendar types and timezone constant in `lib/business-date/index.ts`.
  - Objective: Establish `BusinessDate`, `BusinessMonth`, `BusinessMonthRange`, and the authoritative `Asia/Ho_Chi_Minh` contract without representing a business date as `Date`.
  - Dependency: T002.
  - Completion criteria: Readonly types distinguish calendar values from instant `Date` values; invalid calendar values have an explicit error path; no database types or persisted formats change.
  - Validation: Run TypeScript/lint validation for the new module and inspect the public exports for API sprawl.

- [X] T004 Implement date-only and month input validation plus existing-format serializers in `lib/business-date/index.ts`.
  - Objective: Parse and serialize canonical `YYYY-MM-DD`, `YYYY-MM`, and `MM/YYYY` values without UTC-midnight parsing or host-local calendar construction.
  - Dependency: T003.
  - Completion criteria: Malformed and impossible dates/months are rejected; valid values round-trip; serializers preserve the existing `MM/YYYY` storage contract.
  - Validation: Add and run focused tests for leap/month lengths, malformed input, and date-only round trips.

- [X] T005 Implement explicit-timezone instant extraction, business-month rollover, and local-midnight-to-UTC boundary conversion in `lib/business-date/index.ts`.
  - Objective: Provide only the approved operations: derive business date/month from an instant, add business months, and build start-inclusive/end-exclusive month ranges with real query instants.
  - Dependency: T004.
  - Completion criteria: All `Intl.DateTimeFormat` operations name `Asia/Ho_Chi_Minh`; no browser/process timezone or `new Date(year, month, day)` is authoritative; query boundaries are real instants and local boundaries remain calendar values.
  - Validation: Run pure tests under multiple `TZ` values and verify the boundary candidate is formatted back to the requested local fields.

- [X] T006 Add UTC/Vietnam day-boundary regression tests in `lib/business-date/index.test.ts`.
  - Objective: Prove that UTC date mismatches and local midnight transitions derive the Vietnam business date consistently.
  - Dependency: T005.
  - Completion criteria: Tests cover an instant whose UTC date differs from Vietnam's date and instants immediately before/after local midnight; browser and process timezone are not read.
  - Validation: Run `npm test`; repeat with `TZ=UTC` and a non-Vietnam timezone and compare results.

- [X] T007 Add business-month boundary and range regression tests in `lib/business-date/index.test.ts`.
  - Objective: Prove month rollover and start-inclusive/end-exclusive semantics at Vietnam local month boundaries.
  - Dependency: T005.
  - Completion criteria: Tests cover immediately-before/after month transition, include local start, exclude next local start, and assert expected UTC query instants for Vietnam midnight boundaries.
  - Validation: Run `npm test` under at least two process timezone values and verify date-only strings are not shifted.

## Phase 3: User Story 1 — Interpret Work Dates in Vietnam (P1) 🎯 MVP

**Goal**: Approved operational work-date derivations use the Luminal calendar
regardless of browser or server runtime timezone.

**Independent test**: The pure day-boundary suite passes under different `TZ`
values, and the migrated low-risk call site produces the same business date
from the same instant.

- [X] T008 [US1] Create the implementation-time call-site audit in `specs/001-business-date-policy/call-site-audit.md` covering `services/financialService.ts`, `services/payrollService.ts`, `services/attendanceService.ts`, `app/staff/attendance/AttendanceView.tsx`, `app/admin/attendance/page.tsx`, `services/emailService.ts`, `app/api/check-in/route.ts`, and `app/api/attendance/check-out/route.ts`.
  - Objective: Classify every observed date/time use as approved, leave unchanged, or source-of-truth clarification before changing callers.
  - Dependency: T006 and T007.
  - Completion criteria: The audit names instant timestamps, business dates, business months, display formatting, duration math, and ambiguous attendance authority separately; it records the exact reason each untouched path remains unchanged.
  - Validation: Cross-check every listed path against the repository and confirm no `attendance_logs` authority decision is implied.

- [X] T009 [US1] Migrate the low-risk current-period call site in `services/financialService.ts` to derive the current Luminal business month through `lib/business-date/index.ts`.
  - Objective: Replace host-local month/year extraction while preserving the existing `MM/YYYY` return contract.
  - Dependency: T008.
  - Completion criteria: `getCurrentMonthPeriod()` uses an explicit instant-to-business-month operation; currency helpers and all persistence behavior remain unchanged.
  - Validation: Run focused utility tests plus lint/type validation; verify periods at a UTC/Vietnam month boundary.

- [X] T010 [US1] Validate preserved behavior for the migrated financial period through `services/staffExpensesService.ts` and `app/staff/expenses/ExpensesView.tsx` without introducing duplicate date logic.
  - Objective: Confirm expense creation delegates to the corrected period helper and existing string filtering remains stable.
  - Dependency: T009.
  - Completion criteria: No second business-date implementation is added; `month_period` remains the existing string format; expense employee lookup, mutations, rendering, and currency behavior are unchanged.
  - Validation: Run focused tests and perform a manual current-period expense-filter trace at a month boundary.

## Phase 4: User Story 2 — Interpret Operational Months in Vietnam (P1)

**Goal**: Approved attendance, payroll-period, expense, and reminder month/date
interpretation follows Luminal calendar boundaries with explicit inclusivity.

**Independent test**: Month-boundary tests pass and each migrated caller can be
traced to canonical calendar values or UTC instant ranges without host-local
date construction.

- [X] T011 [US2] Migrate Staff Portal attendance month selection, current work-date derivation, date-only history filtering, and date-only display in `app/staff/attendance/AttendanceView.tsx`.
  - Objective: Replace local month endpoints, locale-dependent today derivation, and `new Date(work_date)` display with business-calendar operations outside JSX.
  - Dependency: T010.
  - Completion criteria: `attendance.work_date` remains a date-only string; range filtering is start-inclusive/end-exclusive using canonical values; check-in/out payloads, shifts, time strings, and source table are unchanged.
  - Validation: Run lint/build-focused checks, utility tests, and a manual Staff Portal history/check-in trace using dates around local midnight and month-end.

- [X] T012 [US2] Migrate admin attendance work-date filtering and calendar-day construction in `app/admin/attendance/page.tsx`.
  - Objective: Compare date-only `work_date` values as calendar values and remove host-local parsing from month grouping and visible calendar calculations.
  - Dependency: T011.
  - Completion criteria: Monthly payroll summaries select the same approved records using business-month values; daily grid selection remains functional; payroll duration/salary calculations and ledger writes are untouched.
  - Validation: Run focused month tests and manually trace admin filtering, daily selection, missing checkout display, and employee filtering at month boundaries.

- [X] T013 [US2] Migrate payroll payment-period month rollover in `app/admin/attendance/page.tsx` through the business-month contract.
  - Objective: Preserve the existing next-month `MM/YYYY` label while removing host-local `Date` month arithmetic.
  - Dependency: T012.
  - Completion criteria: Payment-period month/year and existing category/ledger behavior are unchanged except for timezone-independent month interpretation; no settlement schema or payroll rule changes occur.
  - Validation: Test December-to-January rollover and run a manual payroll month-summary trace without changing salary math.

- [X] T014 [US2] Replace date-only parsing with calendar-value display in `app/admin/attendance/components/DailyAttendanceModal.tsx`.
  - Objective: Prevent a persisted `YYYY-MM-DD` value from shifting during display.
  - Dependency: T012.
  - Completion criteria: Modal date display uses validated calendar fields or the utility formatter; editing, time values, and salary behavior remain unchanged.
  - Validation: Render/inspect dates near midnight and run lint/type validation.

- [X] T015 [US2] Migrate checkout reminder candidate-date derivation in `services/emailService.ts` while preserving the cron workflow in `app/api/cron/attendance-checkout-reminder/route.ts`.
  - Objective: Select candidates using the explicit current Luminal business date without changing email delivery or instant fields.
  - Dependency: T014.
  - Completion criteria: Reminder query uses canonical business `work_date`; `sent_at` remains an instant; merge/filter rules, employee mapping, email variables, and cron route behavior remain unchanged.
  - Validation: Run lint/build checks and manually trace candidate selection at a Luminal day boundary; confirm no route file change is needed.

## Phase 5: User Story 3 — Preserve Event Instants and Historical Records (P2)

**Goal**: Verify that the date policy changes interpretation only and does not
rewrite event evidence or historical records.

**Independent test**: Diff and repository inspection show no migration/rewrite,
and instant-writing paths remain unchanged.

- [X] T016 [US3] Verify instant preservation and historical-record safety across `app/api/check-in/route.ts`, `app/api/attendance/check-out/route.ts`, `services/emailService.ts`, and existing timestamp fields.
  - Objective: Confirm ISO timestamp writes/reads remain instant semantics and no approved caller converts them to naive local persistence.
  - Dependency: T015.
  - Completion criteria: No database migration, update script, historical rewrite, timestamp column/type change, or date-correction path exists in the feature diff.
  - Validation: Inspect the final diff and manually trace check-in, check-out, and sent-at behavior; record exact evidence.

## Phase 6: User Story 4 — Document Ambiguous Attendance Flows (P2)

**Goal**: Preserve unresolved attendance authority and make ambiguous behavior
visible for later specifications.

**Independent test**: The audit identifies the ambiguity and the corresponding
application paths are unchanged.

- [X] T017 [US4] Complete the untouched-path documentation in `specs/001-business-date-policy/call-site-audit.md` for `attendance_logs` writes/updates, `services/attendanceService.ts` overdue cutoff, payroll duration math, instant display formatting, and unrelated project/reporting/payment date paths.
  - Objective: Document why each path is unchanged and prevent accidental source-of-truth or overnight-policy decisions.
  - Dependency: T016.
  - Completion criteria: The audit explicitly states that `attendance` versus `attendance_logs` remains undecided, overnight shifts remain undecided, and historical correction remains deferred.
  - Validation: Compare the audit with the final diff and confirm no listed ambiguous path was modified.

## Phase 7: User Story 5 — Keep Non-Date Behavior Stable (P3)

**Goal**: Demonstrate that attendance, payroll, finance, expense, and reminder
behavior outside approved date/month interpretation remains stable.

**Independent test**: Focused tests, manual operational traces, and final diff
review show only the approved business-date seam and call-site changes.

- [X] T018 [US5] Run repository validation and the complete pure regression suite using the actual scripts in `package.json`.
  - Objective: Validate the implementation without claiming unsupported checks.
  - Dependency: T017.
  - Completion criteria: `npm run lint`, `npm run build`, and `npm test` each have a factual pass/fail result; any pre-existing blocker is recorded.
  - Validation: Run `npm run`, then the three commands above; inspect failures without broadening scope.

- [X] T019 [US5] Perform the manual operational traces in `specs/001-business-date-policy/quickstart.md` for Staff Portal attendance, admin attendance, payroll summary, expense month handling, financial period creation, reminder candidates, and check-in/check-out routes.
  - Objective: Verify preserved workflows and boundary behavior in the actual application paths.
  - Dependency: T018.
  - Completion criteria: Each trace records observed result, boundary input, and whether behavior was intentionally changed or preserved; no deployed RLS/environment correctness is claimed.
  - Validation: Follow every scenario in `quickstart.md` and attach results to the implementation report or review notes.

- [X] T020 [US5] Review the final diff for scope drift across application files, `package.json`, `package-lock.json`, and `specs/001-business-date-policy/`.
  - Objective: Confirm the implementation contains no migration, auth redesign, payroll settlement change, workflow redesign, broad component split, runtime date-time library, or attendance source-of-truth decision.
  - Dependency: T019.
  - Completion criteria: Only the planned utility, regression tests, approved callers, test configuration, and audit documentation are changed; rollback remains source-only.
  - Validation: Run `git diff --check`, inspect `git diff --stat`, and perform a checklist review against the constitution and plan.

## Dependencies and Execution Order

### Phase dependencies

- Phase 1 precedes all other phases.
- Phase 2 precedes all user-story implementation work.
- US1 establishes the first migrated call site and validates the seam before
  the remaining callers are changed.
- US2 depends on US1 because it expands the already validated contract into
  attendance and payroll-period consumers.
- US3 and US4 depend on the approved callers being migrated so their no-change
  claims can be checked against the final diff.
- US5 is final and depends on all prior phases.

### Parallel opportunities

- T006 and T007 can run in parallel after T005 because they touch separate test
  concerns in the same test module only if the implementation team coordinates
  the file; otherwise run them sequentially to avoid conflicts.
- T011 and T014 can be developed in parallel after T010 if the team keeps their
  file changes isolated; T013 must follow T012 because it is in the same admin
  page.
- T016 and T017 are documentation/verification tasks that can be split by
  reviewer after T015, but T017 must incorporate the final audit evidence.

## Implementation Strategy

1. Complete setup and the pure seam first.
2. Deliver US1 as the MVP: tested utility plus one low-risk operational period
   consumer.
3. Migrate approved month/date consumers one file at a time, validating after
   each meaningful slice.
4. Preserve and document ambiguous attendance paths before final validation.
5. Finish with repository checks, manual operational traces, and final diff
   review.

## Explicit exclusions

- No database migration or historical timestamp rewrite.
- No attendance/`attendance_logs` source-of-truth decision.
- No overnight-shift policy.
- No payroll calculation redesign or settlement schema implementation.
- No authentication, Supabase client, RLS, or authorization redesign.
- No production workflow state-machine change.
- No broad component decomposition or unrelated date/reporting migration.

TASKS READY FOR IMPLEMENTATION
