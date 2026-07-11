# Implementation Plan: Supabase, Auth, Attendance Payroll Source of Truth Foundation

**Branch**: `002-supabase-auth-attendance-payroll-foundation`

**Date**: 2026-07-11

**Spec**: [spec.md](./spec.md)

## Summary

Establish the foundation for safe Supabase access, authentication, employee identity, attendance source of truth, payroll source of truth, permissions, RLS, audit logging, migration/backfill, rollback, and regression testing.

This plan is documentation only. It does not authorize application-code changes, dependency installation, database migration, UI changes, or production operations.

## Phase A: Discovery Lock

Purpose: confirm the exact current runtime and schema state before design is converted into code.

Tasks:

- inventory every Supabase client import and usage;
- inventory all environment variables used by application code and deployment docs;
- inspect current Supabase schema for employees, auth links, attendance, attendance logs, shifts, finance ledger, payroll-related records, roles, settings, email, and cron tables;
- inspect current RLS state and policies if available;
- inspect production source map configuration and confirm `productionBrowserSourceMaps` is false or not publicly enabled;
- inventory all critical `full_name`, `requested_by`, `employee_name`, `assignee`, and `assignee_name` relationships;
- inventory all attendance and payroll calculations;
- document that webhook support is Deferred/Out of scope for this specification.

Completion criteria:

- current schema map exists;
- current Supabase client map exists;
- current environment variable map exists;
- current identity and relationship map exists;
- current calculation map exists;
- current source-map exposure status is documented;
- webhook support is documented as Deferred/Out of scope;
- no application code has changed;
- no migration has been created or run.

## Phase B: Contract Design

Purpose: finalize the explicit contracts before touching code.

Tasks:

- choose final public Supabase key name and compatibility path;
- define browser, server session, middleware, and privileged server client modules;
- define server-only and privileged environment variable names;
- define auth/session flow for admin and staff;
- define `employees.auth_user_id -> auth.users.id` as nullable and unique when present;
- define role/permission model;
- define `employees.id` as the long-term employee FK and `employees.employee_id` as a business code, not a FK;
- define attendance event evidence as source of truth and current `attendance` as derived/compatibility data until migration approval;
- define payroll source of truth as attendance evidence, wage/rate history, adjustments, and payroll period;
- define staff payroll visibility as own-only and Owner/Admin/Payroll visibility as explicit permission-scoped;
- define hybrid roles, action permissions, and record-level scopes;
- define wage/rate history as append-only records;
- define attendance correction request/approval lifecycle;
- define audit log schema requirements;
- define RLS policy matrix.

Completion criteria:

- all contract choices are written and approved;
- open questions that block migration are resolved or explicitly deferred;
- no implementation starts before approval.

## Phase C: Regression Baseline

Purpose: freeze current critical behavior before changing source-of-truth paths.

Required fixtures:

- employee with stable ID and full name;
- employee with nullable `auth_user_id`;
- employee with linked `auth_user_id`;
- employee with `employee_id` business code;
- employee with changed display name;
- duplicate full-name conflict scenario;
- normal shift exact 3 hours;
- partial shift that rounds to next unit under current rules;
- late arrival under current rules;
- early departure under current rules;
- overtime under current rules;
- leave/absence under current rules;
- overnight shift;
- cross-day shift;
- missing check-out;
- missing check-in;
- attendance record included in payroll;
- attendance log event not represented in attendance summary;
- wage/rate history scenario;
- payroll adjustment scenario;
- payroll period boundary scenario;
- payroll settlement ledger entry;
- staff attempting cross-employee access.

Tests to design:

- worked-hours calculation;
- shift-unit calculation;
- salary calculation;
- wage/rate lookup priority;
- late arrival behavior;
- early departure behavior;
- overtime behavior;
- leave/absence behavior;
- missing check-in/check-out behavior;
- cross-day shift behavior;
- payroll period behavior;
- payroll adjustment behavior;
- attendance-to-payroll inclusion;
- name-to-ID backfill conflict detection;
- role/resource security matrix;
- no service-role import from client graph;
- staff own-payslip access allowed;
- staff cross-employee payroll access denied;
- Project Manager default payroll access denied;
- attendance correction submitter cannot approve own request.

Completion criteria:

- baseline expected outputs are documented;
- tests are designed before calculation behavior changes;
- any intentionally changed payroll output requires explicit approval;
- no calculation rule is inferred or changed during baseline creation.

## Phase D: Migration And Backfill Design

Purpose: prepare database changes without executing them.

Migration design must include:

- new tables;
- changed columns;
- foreign keys;
- indexes;
- unique constraints;
- RLS policies;
- compatibility views or columns;
- backfill SQL or script outline;
- duplicate-name conflict report;
- data-loss risks;
- rollback SQL outline;
- rollout sequence.

Recommended migration sequence:

1. Add nullable stable relationship fields and indexes after approval.
2. Add `employees.auth_user_id` referencing `auth.users.id`, nullable and unique when present, if absent.
3. Add audit log table.
4. Add or confirm attendance event source schema.
5. Add payroll run/line or settlement reference schema if approved.
6. Add wage/rate history schema if approved.
7. Add attendance correction schema if approved.
8. Backfill stable employee IDs.
9. Enable compatibility readers.
10. Add constraints after backfill approval.
11. Enable or tighten RLS after role mapping is verified.
12. Deprecate legacy name-only paths only after validation.

Completion criteria:

- migration plan is approved before any migration file is created;
- schema diff, duplicate handling, RLS, rollback, and data-loss risks are approved separately;
- rollback and compatibility paths are documented;
- no schema change or backfill is performed in the specification phase;
- no production migration is run without explicit approval.

## Phase E: Implementation Slices

Implementation must wait for approval after this spec and plan.

Recommended safe slices:

1. Supabase client/environment consolidation with no business behavior change.
2. Auth/session replacement plan for admin gate with server-side verification.
3. Staff identity replacement plan for portal token flow.
4. Stable employee relationship additions and read compatibility using `employees.id` as FK.
5. Attendance source service boundary with baseline tests.
6. Payroll calculation service boundary with baseline tests.
7. Permission/RLS enforcement and security matrix tests.
8. Audit log writes for privileged operations.
9. Remove frontend global sensitive fetch/filter patterns.
10. Deprecate name-only relationship fallbacks after migration validation.

Each slice must:

- stay within approved scope;
- include rollback notes;
- run relevant validation;
- report business-rule, database, API, dependency, permission, migration, and security impact.

## Implementation Priority

Security findings that must be treated as high-priority foundation work:

1. Admin auth currently relies on hard-coded passcode behavior or browser-readable cookie state.
2. Staff identity currently relies on URL or localStorage token state.
3. Checkout currently trusts `employeeId` from the frontend.
4. Supabase client usage is mixed across browser, server, middleware, and route contexts.
5. Finance and workflow still link staff records by display name.
6. Attendance source is split between `attendance_logs` and `attendance`.
7. Sensitive payroll and attendance data can be loaded broadly into frontend state.
8. RLS or policy coverage for sensitive tables is incomplete or not documented.
9. Production source maps must not be public.

These priorities do not authorize payroll result changes. Payroll output may change only after audit, fixtures, regression tests, explicit comparison of inconsistencies, and separate user approval.

## Safe Foundation Task Breakdown

These tasks can be implemented without changing current payroll behavior:

1. **Inventory and static maps**
   - Map all Supabase client imports by browser, server route, Server Component, Client Component, middleware, and service usage.
   - Map environment variables and classify them as public, server-only, or privileged.
   - Map current identity inputs, including admin cookie/passcode, staff URL/localStorage token, QR token, and frontend-submitted `employeeId`.
   - Completion: documented maps exist; no application code, migration, or production data changed.

2. **Payroll and attendance behavior audit**
   - Audit all payroll formulas and attendance-derived calculations.
   - Identify every data source used by payroll and attendance summaries.
   - Create the comparison table for duplicate formulas covering location, input, output, difference, data used, affected user flow, and proposed source of truth.
   - Completion: current behavior is described without choosing or changing a formula.

3. **Regression fixture design**
   - Define fixtures for current payroll, attendance, duplicate-name, missing-record, cross-day, overtime, late/early, adjustment, and wage/rate cases.
   - Define expected outputs from current behavior.
   - Completion: fixtures and expected outputs are ready before refactoring calculation logic.

4. **Regression test scaffold**
   - Add focused tests around current calculation behavior once a stable test seam is selected.
   - Add static checks for no service-role import in client paths.
   - Add permission matrix tests or documented manual checks for own-only payroll and attendance access.
   - Completion: tests lock current behavior; no payroll result change is introduced.

5. **Supabase client boundary refactor**
   - Separate browser, server-session, middleware, and privileged server client ownership.
   - Keep query behavior equivalent while preventing privileged imports from client bundles.
   - Completion: lint/type/build pass; no business output or database schema changes.

6. **Auth and identity hardening plan**
   - Replace admin passcode/browser-cookie trust with server-verified auth in an approved implementation slice.
   - Replace staff URL/localStorage long-term identity with server-verified session identity in an approved implementation slice.
   - Remove trust in frontend-submitted `employeeId`, role, and permission claims.
   - Completion: server derives identity; user-visible payroll totals remain unchanged.

7. **Sensitive data scope hardening**
   - Move broad payroll/attendance reads behind server authorization or RLS-scoped queries.
   - Ensure browser receives only authorized records.
   - Completion: access scope is reduced; calculation formulas and outputs stay unchanged.

8. **Relationship compatibility plan**
   - Prepare stable employee-ID relationship plan for finance, workflow, attendance, payroll, and audit references.
   - Keep display names as snapshots.
   - Completion: migration/backfill remains a separate approval; no schema change occurs in foundation documentation.

9. **RLS/server authorization plan**
   - Draft RLS or trusted-server authorization coverage for employees, attendance, payroll, wage/rate, finance, roles, and audit logs.
   - Stage policy rollout with recovery path.
   - Completion: policy plan is explicit; no policy or migration is applied.

10. **Production exposure checks**
    - Confirm `productionBrowserSourceMaps` is false or absent.
    - Confirm public deployment artifacts do not expose `.map` files.
    - Completion: exposure status is documented and any remediation is proposed separately.

## Supabase Client Implementation Target

Target module ownership:

- browser client module: public URL and anon/publishable key only;
- server client module: cookie/session aware and request scoped;
- middleware client module: session refresh only;
- privileged server module: service-role only, server-only import guard, explicit permission precheck.

Static review requirements:

- no privileged variable references in Client Components;
- no service-role imports from `app/**` client files or `component/**`;
- no secret variable starts with `NEXT_PUBLIC_`;
- no server route trusts client-submitted role or employee ID;
- no server route trusts client-submitted permission, payroll scope, or salary access;
- no sensitive authorization logic depends on minification, obfuscation, or hidden frontend code.

## Environment Contract Target

Public:

- `NEXT_PUBLIC_SUPABASE_URL`
- final approved anon/publishable key name

Server-only:

- cron verification secret;
- SMTP settings if moved from `system_settings`;
- server-only app configuration.
- future webhook provider signature verification configuration only after a concrete provider or integration is approved.

Privileged:

- service-role key, if approved for server-only operations.

Acceptance check:

- public variables are safe to expose;
- server-only and privileged variables are never referenced by client modules;
- deployment documentation names every required variable;
- secrets, service-role keys, and business authorization rules are absent from frontend code.

## Attendance Source Strategy

Target:

- event evidence is authoritative;
- check-in, check-out, correction, approval, and related attendance events are source data;
- summaries are derived or compatibility records;
- manual corrections are audited;
- payroll inclusion references source evidence;
- location evidence and business date derivation are preserved.

Compatibility:

- current `attendance` and `attendance_logs` behavior must be traced;
- the current `attendance` table is not deleted, replaced, or cut over before schema audit, backfill plan, and regression tests are approved;
- no table switch occurs until fixtures prove current payroll outputs are preserved or approved changes are listed;
- historical summaries remain readable.

## Payroll Source Strategy

Target:

- payroll run/line or approved settlement source references attendance evidence, employee ID, wage/rate source, period, calculation version, approver, and audit record;
- UI consumes calculated outputs rather than owning formulas;
- finance ledger settlement references payroll source records where applicable;
- staff may view only their own approved payslip, own payroll summary, and own payment status;
- Owner, Admin, and Payroll roles view payroll data only through explicit scoped permission;
- Project Manager does not view payroll by default;
- no staff-wide payroll visibility exists by default.

Compatibility:

- existing `financial_ledger` settlements remain readable;
- existing category/name labels remain display snapshots;
- no payroll result changes without explicit approval;
- current calculation behavior is captured before refactor and not inferred.

Staff payslip fields:

- payroll period;
- standard work;
- actual work;
- worked hours;
- overtime;
- additions;
- deductions;
- total salary;
- payment status.

Wage/rate history target:

- changes append records rather than overwriting old rates;
- each record includes employee ID, rate type, amount, effective dates, creator, created timestamp, and reason/note;
- backdated changes require dedicated permission and audit;
- locked payroll does not change without approved unlock/recalculate flow.

## Permission And RLS Strategy

Policy design must cover:

- employees;
- `employees.auth_user_id` uniqueness and auth-user relationship;
- system roles;
- action permissions;
- record-level scopes;
- attendance source records;
- attendance summaries;
- attendance correction records;
- wage/rate records;
- payroll runs/lines;
- financial ledger;
- audit log;
- role/permission assignments.

Security matrix must be executed or manually verified before release:

- anonymous denied from admin and staff data;
- staff own-only attendance;
- staff denied other payroll;
- staff allowed only own approved payroll output;
- Owner/Admin/Payroll scoped access verified;
- Project Manager denied payroll by default;
- manager scope enforced;
- finance scope enforced;
- admin audited;
- cron secret required;
- webhook support deferred/out of scope until a provider or integration is approved;
- no frontend service-role path;
- production source maps not publicly deployed.

Final blocking business-rule question:

- After current behavior is audited and fixtures are created, are any payroll calculation changes approved?

Webhook is not a blocking question for this specification. It is Deferred/Out of scope until a concrete provider or integration exists. Future webhook work must define provider signature verification, idempotency, retry behavior, replay protection, timestamp tolerance, failure behavior, and logging before implementation.

## Audit Log Strategy

Audit writes should be appended from server-side trusted operations.

Required audit categories:

- permission changes;
- employee auth link changes;
- attendance correction;
- attendance correction approval or rejection;
- wage/rate history changes;
- payroll calculation/approval/settlement;
- cron mutations;
- future webhook mutations only after a provider or integration is approved;
- privileged reads or writes where appropriate.

Audit records must be immutable to ordinary users and readable only by approved admin/auditor roles.

## Validation Plan

Before implementation:

- confirm available scripts with `npm run`;
- define focused tests from the regression baseline.

After implementation slices:

- lint;
- type check where available or `npx tsc --noEmit` if appropriate;
- focused tests;
- production build;
- security matrix;
- manual verification for auth, attendance, payroll, and permission flows;
- production source-map exposure check.

Validation claims must name the exact command or manual check performed.

## Rollback Plan

General rollback:

- revert service/client module changes if no migration occurred;
- keep compatibility columns/tables during migration rollout;
- do not drop legacy name/display fields in first migration;
- disable new readers before removing new schema;
- keep old data readable throughout migration;
- document irreversible operations before approval.

High-risk rollback:

- auth/session changes need an admin recovery path;
- RLS tightening needs staged rollout and tested admin bypass/recovery policy;
- attendance source switch needs dual-read comparison before cutover;
- payroll source switch needs fixture comparison and approval before settlement writes change;
- webhook support is deferred and should not be implemented in this foundation slice.

## File-by-File Implementation Impact

| File or area | Phase | Expected change after approval |
|---|---|---|
| `lib/supabase.ts` | E | Consolidate or deprecate current singleton exports. |
| `ultis/supabase/client.ts` | E | Browser client contract. |
| `ultis/supabase/server.ts` | E | Request-scoped server session client. |
| `ultis/supabase/middleware.ts` | E | Middleware-only session refresh. |
| new privileged server module | E | Server-only privileged client if approved. |
| `app/api/admin/auth/route.ts` | E | Replace hard-coded auth. |
| `app/admin/gatekeeper.tsx` | E | Replace client cookie trust. |
| `app/staff/layout.tsx` | E | Replace long-lived URL/localStorage session source. |
| `services/employeeService.ts` | E | Stable identity helpers. |
| `services/attendanceService.ts` | E | Attendance source boundary. |
| `services/payrollService.ts` | E | Payroll calculation owner and tests. |
| wage/rate history service or table | D/E | Append-only wage/rate history after migration approval. |
| attendance correction service or table | D/E | Correction request and approval lifecycle after migration approval. |
| `services/staffExpensesService.ts` | E | Stable employee relationship for expenses. |
| `services/staffTasksService.ts` | E | Stable assignment matching. |
| `services/workflowService.ts` | E | Stable assignment compatibility. |
| `app/api/check-in/route.ts` | E | Server-derived identity, source, audit. |
| `app/api/attendance/check-out/route.ts` | E | Server-derived identity, source, audit. |
| `app/api/cron/*` | E | Secret verification and audit. |
| `app/api/payments/webhook/route.ts` | Deferred | Out of scope until a concrete provider or integration is approved. |
| `app/admin/attendance/*` | E | Remove UI-owned payroll calculations. |
| `app/staff/attendance/*` | E | Own-record server/RLS enforcement. |
| `app/admin/capital/*` | E | Stable employee references for staff-related ledger records. |
| `lib/types/*` | E | Explicit domain/database types. |
| `supabase/migrations/*` | D/E | Future approved migrations only. |

No file in this table may be changed until this specification and a concrete implementation slice are approved.

## Release Gate

Do not release implementation until:

- security matrix passes or accepted exceptions are documented;
- staff cannot access other staff payroll;
- staff payroll access is limited to own approved payslip, summary, and payment status;
- Owner/Admin/Payroll access is scoped by explicit permission;
- Project Manager has no default payroll access;
- attendance/payroll calculations are covered by regression tests;
- current payroll behavior is fixture-locked before refactor and any changed result is separately approved;
- RLS or trusted server boundaries protect sensitive resources;
- production browser source maps are false or not publicly enabled and public `.map` files are not deployed;
- webhook remains deferred/out of scope unless a future provider/integration specification is approved;
- wage/rate history is append-only and audited;
- attendance correction workflow prevents self-approval and uses approved data for payroll;
- production build passes;
- rollback notes are complete;
- diff is reviewed before commit.
