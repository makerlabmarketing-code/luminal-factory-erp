# Feature Specification: Supabase, Auth, Attendance Payroll Source of Truth Foundation

**Feature Branch**: `[002-supabase-auth-attendance-payroll-foundation]`

**Created**: 2026-07-11

**Status**: Draft

**Input**: User-approved first post-audit specification for Supabase client usage, authentication/session authority, employee identity, attendance/payroll source of truth, permission boundaries, RLS, audit logging, regression baseline, migration/backfill strategy, rollback, and security risk control.

## 1. Problem Statement

The Luminal Factory ERP currently mixes browser Supabase access, server Supabase access, token-based staff identity, hard-coded admin session behavior, direct frontend data loading, and multiple attendance/payroll calculation paths. Critical relationships still depend on display names such as `full_name`, `requested_by`, and `assignee_name`.

This creates four core risks:

- unauthorized access to admin, payroll, salary, attendance, or finance data;
- inconsistent attendance and payroll totals because source records and formulas differ by route or UI;
- broken historical traceability when employee names change or duplicate names exist;
- unsafe refactoring because the repository lacks one approved contract for clients, environment variables, identities, permissions, RLS, audit logs, and regression tests.

This specification defines the foundation before implementation. It does not modify application code, create migrations, install dependencies, or change UI.

## 2. Current State

- Supabase clients exist in `lib/supabase.ts` and `ultis/supabase/*`.
- Environment naming mixes `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- Some server code uses a plain anon-key client without request session context.
- Admin authentication currently uses a hard-coded passcode and client-readable cookie.
- Staff portal identity currently depends on a URL/localStorage token and `employees.qr_token`.
- Attendance has at least two record families: `attendance` and `attendance_logs`.
- Staff check-in/check-out API routes use `attendance_logs`; staff/admin attendance views and payroll summaries rely primarily on `attendance`.
- Payroll calculations exist in services and UI with different assumptions.
- Employee, finance, workflow, and assignment relationships still use display names in important paths.
- RLS requirements and policy ownership are not documented in the repository.
- Only business-date regression tests are currently present.

## 3. Goals

- Define one Supabase client model for browser, server, middleware, and privileged server use.
- Define one environment variable contract split into public, server-only, and privileged variables.
- Define authentication and session source of truth.
- Define employee identity source of truth and stable relationship identifiers.
- Remove approved future dependence on `full_name` for critical relationships.
- Define attendance source of truth and compatibility strategy.
- Define payroll source of truth and calculation ownership.
- Define permission boundaries for admin, staff, finance, attendance, payroll, and service operations.
- Define RLS requirements for sensitive tables.
- Define audit log requirements for sensitive operations.
- Define regression test baseline before changing calculation behavior.
- Define migration, backfill, compatibility, and rollback strategy.
- Identify affected APIs, services, types, and components.

## 4. Non-Goals

- Do not implement code in this specification phase.
- Do not create or run migrations in this specification phase.
- Do not install dependencies.
- Do not change UI or Vietnamese copy in this phase.
- Do not redesign the whole ERP shell.
- Do not change approved business-date policy.
- Do not alter payroll results without an approved calculation baseline and explicit approval.
- Do not implement internal webhooks between modules.
- Do not implement webhook support in this specification.
- Do not introduce service-role credentials to browser code.
- Do not replace real business logic with mock services.

## 4A. Deferred / Out Of Scope

Webhook support is deferred and out of scope for this specification.

Rationale:

- the ERP is still small;
- no concrete external provider or integration contract is approved;
- internal module-to-module webhooks would add infrastructure without a current operational need.

Rules:

- Do not implement internal webhooks between ERP modules.
- Do not add or harden webhook behavior by guessing provider requirements.
- Add webhook support only when a concrete provider or integration exists.
- At that time, define provider signature verification, idempotency, retry behavior, replay protection, timestamp tolerance, failure handling, and logging before any webhook mutation is implemented.

## 5. Approved Business Rules

- Display names are presentation values, not relationship keys.
- Stable employee identifiers must back persisted employee relationships.
- `employees.id` is the long-term internal primary key and foreign key for employee relationships.
- `employees.employee_id` is a business code for display, search, and integration. It is not the primary foreign key.
- `full_name` is display data only and must never be used to link records.
- Payroll derives from approved source inputs and calculation rules outside transient UI state.
- Attendance records represent operational time evidence.
- Attendance event evidence is the source data for check-in, check-out, correction, approval, and related attendance events.
- Worked hours must derive from authoritative timestamps and approved adjustment rules.
- Salary and payroll data are sensitive and require record-level permission.
- UI visibility is not an authorization boundary.
- Every permission that matters must be enforced server-side, through RLS, or both.
- Luminal business dates and months follow the approved `Asia/Ho_Chi_Minh` business-date policy.
- Vietnamese UI vocabulary remains governed by `references/ui-rules.md`; this spec does not change UI labels.

## 6. Data Ownership Map

| Area | Source-of-truth owner | Notes |
|---|---|---|
| Supabase client contract | `references/supabase-contract.md` plus this spec | Implementation must consolidate current duplicate patterns. |
| Auth session | Supabase Auth session plus server-verified role claims/profile records | Final auth source must not be a client-set cookie or URL token. |
| Employee identity | `employees.id` | Internal primary key and long-term FK for employee relationships. |
| Employee business code | `employees.employee_id` | Display/search/integration code; unique if current data permits; not the FK source. |
| User-to-employee link | `employees.auth_user_id -> auth.users.id` | Nullable for employees without accounts; unique for linked employees. |
| Attendance evidence | Event evidence records | Source for check-in, check-out, correction, approval, and related events. |
| Attendance summary/read model | Current `attendance` table or future read model | Derived or compatibility data only until schema audit, backfill, and tests are approved. |
| Payroll input | Approved attendance source plus approved wage/rate records and approved adjustments | UI summaries are derived, not authoritative. |
| Payroll output | Dedicated payroll run/line records or current ledger-compatible settlement record after approved migration plan | Must be reproducible from inputs. |
| Finance ledger | `financial_ledger` source records | Employee relation must move away from `requested_by` name-only matching. |
| Audit log | Dedicated append-only audit records | Required for auth, attendance correction, payroll, privileged changes, and permission changes. |

### Current Source Of Truth And Target Source Of Truth

| Domain | Current observed source | Target source of truth |
|---|---|---|
| Auth/session | Hard-coded admin passcode/cookie; staff URL/localStorage token; partial Supabase clients | Supabase Auth session or approved server-verified session flow. |
| Employee identity | `employees` plus name/code fallbacks | `employees.id` as FK; `employees.employee_id` as unique business code if possible; `full_name` display only. |
| Auth-to-employee link | Not confirmed in current schema | Nullable unique `employees.auth_user_id` referencing `auth.users.id`. |
| Attendance event evidence | `attendance_logs` used by check-in/check-out APIs; schema authority not yet audited | Event evidence records for check-in, check-out, correction, approval, and related events. |
| Attendance summary | `attendance` used by staff/admin attendance and payroll summaries | Derived or compatibility read model, not source data. |
| Payroll input | UI/service calculations over current attendance records with inconsistent formulas | Confirmed attendance evidence, wage/rate history, adjustments, and payroll period. |
| Payroll output | UI summaries and `financial_ledger` settlement entries | Reproducible payroll run/line or approved compatible settlement records. |
| Payroll permission | Not consistently documented/enforced | Record-level RLS or server-side authorization. |
| Webhook mutation | Payload-driven route with no verified provider contract in repo | Deferred/out of scope until a concrete provider or integration is approved. |

## 7. Identity Model

The target identity model has three distinct concepts:

- **Auth user**: Supabase Auth account. Owns login/session and trusted authentication identity.
- **Employee**: Operational staff profile. Owns staff metadata, branch, role assignment, attendance, payroll, and staff portal access.
- **Role/permission assignment**: Server/RLS-readable permission record that authorizes actions.

Stable relationship decisions:

- Use `employees.id` as the internal primary key and long-term foreign key for attendance, payroll, finance, workflow assignment, and audit actor references.
- Use `auth.users.id` for authenticated session ownership.
- Add `employees.auth_user_id` as the explicit link to Supabase Auth. It references `auth.users.id`, is unique when present, and may be null for employees without accounts.
- `employees.employee_id` is a business code for display, search, and integration. It should be unique if current data permits, but it is not the primary FK.
- `full_name`, `assignee_name`, `employee_name`, and `requested_by` may remain denormalized display snapshots, but must never be authoritative relationship keys.
- Staff QR or portal tokens must not be stored in URL/localStorage as the long-term authentication source.

### Identity Relationship Map

| Relationship | Target key | Cardinality | Nullable | Purpose |
|---|---|---:|---:|---|
| `auth.users.id -> employees.auth_user_id` | `employees.auth_user_id` | one auth user to zero/one employee | yes | Login/session to staff profile. |
| `employees.id -> attendance event employee_id` | `employees.id` | one employee to many events | no after migration | Attendance event ownership. |
| `employees.id -> attendance summary employee_id` | `employees.id` | one employee to many summaries | no after compatibility | Derived attendance read model. |
| `employees.id -> payroll line employee_id` | `employees.id` | one employee to many payroll lines | no | Payroll ownership and RLS. |
| `employees.id -> financial_ledger employee_id` | `employees.id` | one employee to many staff-related ledger records | nullable for non-staff ledger rows | Staff expense/payroll settlement relationship. |
| `employees.id -> workflow task assignee_id` | `employees.id` | one employee to many assignments | nullable | Operational assignment. |
| `employees.id -> audit_log.actor_employee_id` | `employees.id` | one employee to many audit records | yes | Actor trace when session maps to employee. |
| `employees.employee_id` | business code | unique if data permits | yes | Display, search, external integration. |
| `employees.full_name` | display text | not a relationship | no/legacy dependent | Human-readable label only. |

## 8. Supabase Client Model

Target clients:

- **Browser client**: Uses only public Supabase URL and anon/publishable key. It may read/write only what RLS allows for the authenticated user.
- **Server session client**: Uses request cookies/session. It performs server-side data loading and authorization-aware operations as the authenticated user.
- **Middleware auth client**: Refreshes or validates sessions only. It must not become a generic query client.
- **Privileged server client**: Uses service-role or privileged credentials only in server-only modules for approved operations that cannot be performed under user RLS. It must never be imported by Client Components or browser bundles.

Rules:

- Do not trust `userId`, role, employee ID, or permission values submitted from the client.
- Server routes must derive identity from the Supabase session or a server-verified token exchange.
- Privileged server operations must validate caller identity and permission before using elevated access.
- Sensitive data must not be fetched broadly into the browser and filtered locally.

## 9. Environment Variable Contract

### Public

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` or final approved publishable-key name

Public variables may appear in the browser bundle. They are not secrets.

### Server-only

- SMTP settings if kept in environment rather than `system_settings`
- cron secrets or scheduler verification secrets
- internal app base URLs when needed by server routes
- webhook provider signing secrets only after a concrete provider contract is approved in a future specification

Server-only variables must not use the `NEXT_PUBLIC_` prefix.

### Privileged

- `SUPABASE_SERVICE_ROLE_KEY` or final approved service-role variable

Privileged variables are server-only, must be imported only from server-only modules, and must be guarded against accidental client bundle import.

### Compatibility

The implementation plan must choose between `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` after deployment configuration is inspected. Retain both names only with an explicit compatibility note.

## 10. Auth And Session Flow

Target flow:

1. User signs in through Supabase Auth or an approved server-mediated staff login/token exchange.
2. Supabase session is stored in secure HTTP-only cookies through the server/client auth integration.
3. Server-side code derives `authUserId` from the verified session.
4. Server-side code maps `authUserId` to `employees.id` through `employees.auth_user_id` and then resolves roles/permissions.
5. Browser UI receives only the data and actions allowed for that session.
6. Sensitive mutations run through server routes or server actions with permission checks and RLS enforcement.

Admin flow:

- Replace hard-coded passcode/session cookie with Supabase Auth plus admin/role authorization.
- Admin status must come from a trusted role/permission source, not client state.

Staff flow:

- Replace long-lived URL/localStorage staff token as the source of truth.
- If QR token support remains, it must become a short-lived server-verified bootstrap or check-in credential, not an unrestricted portal session.
- Frontend requests may submit form data, but must not be trusted for `userId`, `employeeId`, role, payroll scope, or salary access.

## 11. Attendance Source Of Truth

Target decision:

- Authoritative attendance evidence is event-based. It covers check-in, check-out, manual correction, approval, and related attendance events.
- Event evidence records must use `employees.id` as the employee relationship after migration.
- The current `attendance_logs` table is an observed event-evidence candidate, but implementation must inspect live schema before declaring it final.
- The current `attendance` table is not the target source of truth. It may remain a derived summary or compatibility read model during migration.
- Do not delete, replace, or cut over from the current `attendance` table before schema audit, backfill plan, and regression tests are approved.

Required attendance source model:

- stable employee relation;
- check-in timestamp;
- check-out timestamp when present;
- work date derived through the approved business-date policy;
- shift relation or shift snapshot;
- location evidence when required;
- status with controlled values;
- manual correction fields;
- audit trail for creation, update, correction, deletion, and payroll inclusion.

No implementation may switch payroll to a new source without a regression baseline and backfill verification.

## 12. Payroll Source Of Truth

Target decision:

- Payroll source inputs are approved attendance evidence, approved wage/rate records, approved adjustments, and approved payroll period.
- Payroll output must be reproducible payroll run/line records or a compatible settlement ledger with enough source references to reproduce totals.
- UI-calculated summaries are not source of truth.
- Payroll settlement into `financial_ledger` must reference stable employee IDs and source payroll records, not only category strings and names.
- Staff may view only their own payslip, own payroll summary, and own payment status if that product behavior is approved.
- Owner, Admin, or Payroll roles may view payroll data only within explicit permissions.
- There is no default permission for all staff to view payroll data.

Sensitive payroll fields must be protected with record-level permissions.

## 13. Calculation Ownership

| Calculation | Owner | Requirement |
|---|---|---|
| Business date/month | `lib/business-date` | Already established by spec 001. |
| Attendance event normalization | New or existing attendance service | Pure, tested where practical. |
| Worked-hours calculation | Payroll/attendance calculation module, not UI | Must document rounding and overnight rules. |
| Shift unit calculation | Payroll calculation module | Must preserve approved 3-hour block behavior until explicitly changed. |
| Wage/rate lookup | Payroll service or employee compensation service | Must use stable employee identity and approved rate source. |
| Salary total | Payroll calculation module | Must be regression-tested. |
| Payroll settlement | Payroll service | Must be auditable and permission-checked. |
| Attendance display summary | UI derives from service outputs only | UI must not own core payroll math. |

Open policy items must be resolved before implementation changes results:

- current rounding rule for worked hours and shift units;
- late arrival behavior;
- early departure behavior;
- overtime behavior;
- leave/absence behavior;
- missing check-in/check-out behavior;
- cross-day shift behavior;
- wage/rate history behavior;
- adjustment behavior;
- payroll period behavior;
- manual correction authority.

Do not change or infer calculation rules during this specification. Before implementation, current behavior must be captured with fixtures and regression tests. Any change that alters payroll results requires separate user approval.

Payroll calculation remains a blocking business-rule question for any change that would make payroll output differ from current behavior. It does not block foundation refactors that preserve current behavior.

Before refactoring payroll calculation logic:

- audit every current formula;
- identify every data source;
- create representative fixtures;
- create regression tests that lock current behavior;
- document inconsistent cases without fixing them.

Do not automatically fix payroll formulas or choose a formula that appears more correct. If multiple formulas exist for the same business operation, produce this comparison before proposing any result change:

| Code location | Input | Output | Difference | Data used | Affected user flow | Proposed source of truth |
|---|---|---|---|---|---|---|
| To be completed during audit. | To be completed during audit. | To be completed during audit. | To be completed during audit. | To be completed during audit. | To be completed during audit. | To be proposed after audit. |

## 14. Permission Model

The approved permission model is hybrid:

- system roles group permissions;
- action permissions authorize concrete operations;
- record-level data scope limits which records the permission applies to;
- backend, RLS, or server authorization must check the effective permission;
- UI may reflect permissions, but UI is not the security boundary.

Planned roles:

- **Owner**: business owner role with explicit high-scope permissions.
- **Staff**: view own profile, own attendance, own assigned work, own expense submissions, and allowed self-service actions. Staff may view only their own approved payroll output if that behavior is enabled.
- **Project Manager**: project/team-scoped operational management. Project Manager does not receive payroll visibility by default.
- **Reviewer**: review/approval role for assigned review workflows.
- **Manager**: view/manage assigned staff or operational scope if granted.
- **Payroll/Finance**: view/manage payroll or finance scope only through explicit permissions.
- **Admin**: manage system settings, employees, permissions, and operational records within approved boundaries.
- **Service/Cron**: run approved scheduled tasks with server-side secret verification and audit.

Initial action permissions:

- `project.view`
- `project.create`
- `project.update`
- `project.archive`
- `task.assign`
- `task.approve`
- `attendance.view_own`
- `attendance.view_team`
- `attendance.correct`
- `attendance.approve_correction`
- `payroll.view_own`
- `payroll.view_all`
- `payroll.calculate`
- `payroll.approve`
- `payroll.mark_paid`
- `finance.view`
- `audit.view`
- `role.manage`

Rules:

- Staff must not view another employee's payroll or salary unless explicitly authorized.
- Staff do not receive broad payroll visibility by default.
- Owner, Admin, and Payroll roles require explicit scoped permission to view payroll and salary data.
- Project Manager does not receive payroll visibility by default.
- Staff must not submit attendance for another employee through client-controlled IDs.
- Finance/payroll access must be record-scoped.
- Admin UI navigation may hide modules, but data access must still be enforced by server/RLS.
- Cron routes require an approved scheduler secret. Webhook routes are deferred/out of scope until a provider or integration contract is approved.

## 15. RLS Model

Required RLS categories:

- Employees: staff can read limited own profile; admin/authorized managers can read permitted staff.
- Attendance event/source records: staff can read own records; insert/update only through approved server path or constrained policy.
- Attendance summaries: staff can read own summaries; managers/admin can read permitted scope.
- Payroll inputs/rates: restricted to payroll/admin roles; staff cannot read other staff rates.
- Payroll outputs/runs/lines: staff can read own allowed payslip-level output only if approved; finance/admin can read permitted scope.
- Financial ledger: finance/admin scoped access; staff can read own expense submissions where appropriate.
- Audit log: append through server; read restricted to admin/auditor roles.
- Roles/permissions: admin-only with audit.

RLS policy design must be documented before migration. Production RLS changes require explicit approval.

## 15A. Staff Payroll Visibility

Staff may view only their own detailed payslip and related payroll status.

Allowed own-payroll fields:

- payroll period;
- standard work;
- actual work;
- worked hours;
- overtime;
- additions;
- deductions;
- total salary;
- payment status.

Staff must not see another employee's salary, payroll summary, wage/rate history, or payslip.

Owner, Admin, and Payroll/Finance may view broader payroll data only when the effective permission includes the required action and record scope. Project Manager has no default payroll visibility.

## 15B. Wage And Rate History

Do not overwrite old wage or rate values.

Each wage/rate change must create a historical record with:

- `employee_id`;
- rate type;
- amount;
- `effective_from`;
- `effective_to` when present;
- `created_by`;
- `created_at`;
- reason or note.

Payroll for a period must use the wage/rate record effective for that period. Backdated wage/rate changes require a separate permission and audit log. Locked payroll must not change unless an approved unlock and recalculation process exists.

## 15C. Attendance Correction

Staff may submit correction requests for their own attendance. Staff must not approve their own correction requests.

Project Manager may approve correction requests within assigned team or project scope only when the effective permission allows it. Owner or Admin may approve across all scope only when the effective permission allows it. Payroll may view approved corrections for payroll calculation, but Payroll does not receive default permission to correct or approve attendance.

Each correction must store:

- related attendance record or event;
- old value;
- requested value;
- reason;
- submitter;
- submitted time;
- reviewer;
- decision;
- reviewed time;
- note;
- attachment when present.

Attendance used for payroll must come only from approved data.

## 16. Audit Log Model

Audit log records must capture:

- actor auth user ID;
- actor employee ID when available;
- action;
- resource type;
- resource ID;
- old values or hash/summary where appropriate;
- new values or hash/summary where appropriate;
- reason/note when required;
- request source;
- created timestamp;
- elevated/override flag;
- correlation ID for multi-step operations when available.

Required audited actions:

- login/session-sensitive admin actions;
- permission and role changes;
- employee identity link changes;
- attendance creation, correction, deletion, and approval;
- payroll calculation, approval, settlement, and export;
- privileged server operations;
- cron runs affecting attendance, payroll, or finance.
- future webhook processing affecting attendance, payroll, or finance after a provider or integration contract is approved.

## 17. Security Requirements

- No secret may be present in frontend code, client bundle, browser logs, or public environment variables.
- Service-role credentials must never be imported by Client Components.
- Do not trust user ID, employee ID, role, permission, salary, or scope values submitted by the client.
- Payroll and salary records require record-level authorization.
- Attendance and payroll data must not be loaded globally into frontend state and filtered locally.
- Production source map exposure must be checked before deployment.
- Sensitive staff tokens must not be stored in localStorage, URL query strings, or client logs as long-term credentials.
- API routes that perform privileged work must verify server-side session, role, scope, and/or signed secret.
- Webhook implementation is deferred/out of scope until a concrete provider or integration is approved.
- Future production webhooks must verify the provider signature before mutating data.
- Future webhook design must not trust payloads only because an endpoint URL is secret.
- Future webhook design must define provider, signature header, signing algorithm, secret storage, idempotency, retry behavior, replay protection, timestamp tolerance, failure behavior, and logging before implementation.
- Cron routes must verify an approved scheduler secret.
- Errors returned to users must not expose secrets, raw database internals, or privileged identifiers.
- `productionBrowserSourceMaps` must be `false` or not publicly enabled.
- Public `.map` files must not be deployed.
- Source maps may be uploaded privately to an error-monitoring service only if the system uses one.
- Minification or obfuscation must not be treated as a security control.

### Security Test Matrix

| Role | Resource | Expected result |
|---|---|---|
| Anonymous | Admin routes | Denied. |
| Anonymous | Staff portal without verified session | Denied or bootstrap-only flow. |
| Staff A | Staff A attendance | Allowed read for own records. |
| Staff A | Staff B attendance | Denied. |
| Staff A | Staff B payroll | Denied. |
| Staff A | Own salary/rate source | Denied unless approved payslip view exists. |
| Staff A | Submit own attendance | Allowed only through verified identity path. |
| Staff A | Submit attendance as Staff B by changing request body | Denied. |
| Manager | Staff outside scope | Denied. |
| Finance | Payroll within permitted scope | Allowed. |
| Finance | Permission management | Denied unless separately granted. |
| Admin | Employee/permission management | Allowed with audit. |
| Browser client | Service-role client import | Build/test must fail or static check must detect none. |
| Cron caller without secret | Cron endpoint | Denied. |
| Future webhook without valid provider signature | Provider webhook after future approval | Denied. |

## 18. Data Migration Plan

No migration is created in this specification phase.

No schema change, backfill, application-code change, or migration file is approved by this specification update.

Future migration planning must include:

- current schema inventory for `employees`, `attendance`, `attendance_logs`, `shifts`, `financial_ledger`, payroll-related records, roles, and settings;
- proposed stable `employees.id` foreign keys;
- proposed nullable unique `employees.auth_user_id` reference to `auth.users.id`;
- proposed uniqueness treatment for `employees.employee_id` if current data permits;
- proposed attendance event/source schema or chosen existing table;
- proposed payroll run/line or settlement schema;
- proposed RLS policies;
- indexes for employee, date range, payroll period, and auth mapping;
- compatibility views or compatibility columns where needed;
- backfill dry-run queries;
- data-loss risk report;
- rollback plan.

Migration may proceed only after schema diff, duplicate handling, RLS, rollback, and data-loss risks are approved separately.

## 19. Backfill Plan

Backfill strategy:

1. Inventory records that currently use `full_name`, `requested_by`, `employee_name`, `assignee`, or `assignee_name`.
2. Match records to employees by stable existing IDs when present.
3. For name-only records, produce a conflict report for duplicate, missing, inactive, or changed names.
4. Do not auto-resolve ambiguous matches.
5. Add stable foreign keys in nullable compatibility mode first.
6. Backfill stable IDs with audited scripts or migration steps after approval.
7. Keep display-name snapshots for historical readability.
8. Add constraints only after backfill coverage and conflict resolution are approved.

## 20. Rollback Plan

Rollback must preserve data access and payroll integrity.

Required rollback strategy:

- keep old columns readable during compatibility window;
- do not drop name snapshot fields in the first migration;
- add new columns/tables before switching readers;
- switch reads behind service boundaries, not directly in UI;
- keep rollback SQL for new nullable columns, policies, indexes, and views;
- keep pre-migration conflict reports;
- document any operation that cannot be losslessly rolled back;
- avoid recalculating historical payroll during initial migration unless explicitly approved.

## 21. Test Plan

Regression baseline before implementation:

- snapshot current attendance/payroll calculation outputs for representative fixtures;
- audit and test current worked-hours calculation including rounding, late arrival, early departure, overtime, leave/absence, missing check-in/check-out, cross-day shifts, and invalid times;
- test salary calculation with current hourly/shift rate rules;
- test wage/rate history and adjustment behavior after current behavior is audited;
- test payroll period behavior;
- test attendance source compatibility between current `attendance` and `attendance_logs` assumptions;
- test employee identity matching and duplicate-name conflicts;
- test permission matrix for staff/admin/finance/manager/service roles;
- test RLS behavior for sensitive tables;
- test no service-role key in client bundle or client-import graph;
- test cron rejection without valid scheduler secret;
- test future webhook rejection without valid provider signature only after a concrete webhook provider or integration is approved;
- run lint, type check, production build, and focused tests after implementation.

No calculation rule may be changed automatically. Specifically, do not change rounding, late arrival, early departure, overtime, cross-day shift handling, leave/absence, missing check-in/check-out, adjustments, or payroll period behavior without a separate proposal and user approval.

## 22. Acceptance Criteria

- AC-001: One documented Supabase client strategy exists and every Supabase client import is classified as browser, server session, middleware, or privileged server.
- AC-002: Final environment variable contract lists public, server-only, and privileged variables.
- AC-003: No service-role credential is imported by client-side modules or included in the client bundle.
- AC-004: Auth/session source of truth is Supabase Auth or an approved server-verified session flow, not a client-set cookie.
- AC-005: Staff long-term authentication does not depend on URL query token or localStorage.
- AC-005A: No admin passcode or privileged credential exists in client code or browser-readable state.
- AC-005B: Server routes do not trust client-submitted `employeeId`, user ID, role, permission, payroll scope, or salary access.
- AC-006: Critical employee relationships no longer depend on `full_name` as the authoritative key after implementation.
- AC-007: `employees.id` is documented as the long-term employee FK for attendance, payroll, finance, workflow assignment, and audit references.
- AC-008: `employees.auth_user_id` is documented as nullable, unique when present, and referencing `auth.users.id`.
- AC-009: `employees.employee_id` is documented as a business code for display/search/integration, not the primary FK.
- AC-010: Attendance event evidence is documented as the source of truth, with current `attendance` retained only as derived or compatibility data until approved migration.
- AC-011: Payroll source of truth is documented and excludes transient UI state.
- AC-012: Attendance and payroll calculation owners are documented and covered by fixtures and regression tests for current calculation behavior.
- AC-013: Regression fixtures cover rounding, late arrival, early departure, overtime, leave/absence, missing check-in/check-out, cross-day shifts, wage/rate history, adjustments, and payroll period.
- AC-014: Current payroll results do not change except for calculation changes explicitly approved after audit and fixtures.
- AC-015: Payroll and salary records have record-level permission requirements and RLS/server enforcement plan.
- AC-016: Staff cannot read another employee's payroll in the security matrix.
- AC-017: Staff payroll visibility is limited to own payslip, own payroll summary, and own payment status if approved.
- AC-018: Owner, Admin, and Payroll roles have explicit scoped payroll permissions.
- AC-019: Project Manager has no default payroll visibility.
- AC-020: The permission model documents system roles, action permissions, and record-level scope.
- AC-021: Sensitive payroll and attendance data is not loaded beyond the user's authorized scope, and pages/services do not load all sensitive records into the frontend and filter locally.
- AC-022: Cron routes have server-side verification requirements.
- AC-023: Webhook support is marked Deferred/Out of scope and no webhook implementation is required or approved by this specification.
- AC-024: Audit log requirements cover attendance corrections, payroll approvals, wage/rate changes, permission changes, and privileged operations.
- AC-025: Wage/rate history records include employee, rate type, amount, effective dates, creator, created timestamp, and reason/note.
- AC-026: Locked payroll does not change from wage/rate edits unless an approved unlock/recalculation process exists.
- AC-027: Attendance correction requirements cover related record/event, old value, requested value, reason, submitter, submitted time, reviewer, decision, reviewed time, note, and attachment.
- AC-028: Attendance used for payroll comes only from approved data.
- AC-029: Migration plan includes schema diff, indexes, constraints, policies, backfill, compatibility, rollback, and data-loss risks before any migration is created.
- AC-030: Backfill plan includes duplicate/missing employee-name conflict reporting.
- AC-031: Production source map exposure is checked: `productionBrowserSourceMaps` is false or not publicly enabled, and public `.map` files are not deployed.
- AC-032: No implementation creates migration, changes schema, runs backfill, or changes application code before separate approval.
- AC-033: Lint passes after implementation.
- AC-034: Type check passes after implementation.
- AC-035: Production build passes after implementation.
- AC-036: Focused attendance/payroll/security tests pass after implementation.

## 23. File-by-File Impact Plan

| File or area | Expected impact |
|---|---|
| `lib/supabase.ts` | Consolidate or deprecate duplicate client exports. |
| `ultis/supabase/client.ts` | Align browser client naming and source. |
| `ultis/supabase/server.ts` | Confirm request-session server client ownership. |
| `ultis/supabase/middleware.ts` | Align env naming and middleware-only role. |
| `app/api/admin/auth/route.ts` | Replace hard-coded passcode/session model in implementation phase. |
| `app/admin/gatekeeper.tsx` | Replace client cookie trust with server/session-backed permission flow. |
| `app/staff/layout.tsx` | Replace long-lived URL/localStorage token reliance. |
| `services/employeeService.ts` | Own stable employee lookup helpers. |
| `services/attendanceService.ts` | Move attendance source and calculation boundaries here or into a dedicated attendance domain module. |
| `services/payrollService.ts` | Own payroll calculation baseline and tests. |
| `services/staffProfileService.ts` | Align wage/rate lookup with approved payroll source. |
| `services/staffPortalService.ts` | Replace token identity assumptions with server-verified identity. |
| `services/staffExpensesService.ts` | Replace `requested_by = full_name` relationship with stable employee reference. |
| `services/workflowService.ts` | Replace assignment-by-name fallback where scope overlaps employee identity. |
| `services/repositories/workflowRepository.ts` | Preserve display snapshots but write stable assignment IDs. |
| `app/api/check-in/route.ts` | Align identity, attendance source, permission, and audit behavior. |
| `app/api/attendance/check-out/route.ts` | Align identity, source, calculation, permission, and audit behavior. |
| `app/api/cron/*` | Add scheduler verification and audit requirements. |
| `app/api/payments/webhook/route.ts` | Deferred/out of scope for this specification; future provider integration must define verification before mutation. |
| `app/admin/attendance/*` | Stop owning payroll calculations in UI; consume service outputs. |
| `app/staff/attendance/*` | Stop trusting client-controlled employee identity. |
| `app/admin/capital/*` | Replace name-based finance relations where payroll/employee settlement overlaps. |
| `lib/types/*` | Add explicit domain/database types after schema plan is approved. |
| `supabase/migrations/*` | Future migrations only after schema/backfill/RLS approval. |

## 24. Open Questions

### Codex Can Answer By Auditing Code Or Schema

- Does the current schema already have `employees.auth_user_id`?
- Does the current schema already enforce uniqueness for `employees.employee_id`?
- Which tables currently store employee references by `full_name`, `requested_by`, `employee_name`, `assignee`, or `assignee_name`?
- What columns exist today on `attendance` and `attendance_logs`?
- Which current routes write `attendance`, `attendance_logs`, payroll-related records, or `financial_ledger`?
- What are the current calculation rules in code for rounding, late arrival, early departure, overtime, leave/absence, missing check-in/check-out, cross-day shifts, wage/rate history, adjustments, and payroll period?
- Does `next.config.js` currently enable `productionBrowserSourceMaps`?
- Which environment variables are currently referenced in code?
- Which Supabase clients are imported from Client Components, Server Components, services, middleware, and route handlers?
- Which current API routes trust client-submitted `employeeId`, `userId`, role, or token?

### Business Decisions Needed From User

- **BLOCKING AFTER AUDIT**: After current behavior is audited and fixtures are created, are any payroll calculation changes approved?

### Resolved Business Decisions

- Identity: use `employees.id` as the primary internal FK.
- Employee business code: use `employees.employee_id` for display/search/integration and make it unique if current data permits.
- Supabase Auth link: use nullable unique `employees.auth_user_id -> auth.users.id`.
- Attendance source: event evidence is source data; current `attendance` is derived/compatibility until approved migration.
- Payroll source: attendance evidence, wage/rate history, adjustments, and payroll period.
- Permission model: hybrid role, action permission, and record-level scope.
- Staff payroll visibility: own detailed payslip only; no other staff payroll.
- Wage/rate history: append-only history; no overwriting old rates.
- Attendance correction: staff can request own correction, cannot approve own correction, and payroll uses approved data only.
- Payroll calculation changes: no automatic changes; current behavior must be fixture-locked first.
- Webhook: deferred/out of scope until a concrete provider or integration exists.

## 24A. Repository Audit Evidence

| Question | Evidence found | File or schema | Conclusion | Confidence |
|---|---|---|---|---|
| Does the current schema already have `employees.auth_user_id`? | No repo migration or type references contain `auth_user_id`; code searches found none before this spec text. | `supabase/migrations/*`, `lib/types/employee.ts`, `services/*` | No evidence in repository schema/code that `employees.auth_user_id` exists. Live DB still needs schema audit. | Medium |
| Does the current schema enforce uniqueness for `employees.employee_id`? | No repo migration defines `employees`; code treats `employee_id` as optional and searches by `id` or `employee_id`. | `lib/types/employee.ts`, `services/employeeService.ts`; no `employees` migration in repo | No repository evidence of a unique constraint. Live DB still needs schema audit. | Medium |
| Which records use name-based relationships? | `financial_ledger.requested_by` is set from employee full name; workflow stores `assignee_name`/`assignee`; staff tasks fallback to `assignee_name`; employee lookup by `full_name` exists. | `app/admin/capital/page.tsx`, `services/staffExpensesService.ts`, `app/admin/tasks/page.tsx`, `services/staffTasksService.ts`, `services/employeeService.ts` | Critical name-based relationships remain in finance, workflow assignment, and staff task matching. | High |
| What columns exist today on `attendance` and `attendance_logs`? | Repo has no migrations for either table. Code implies `attendance`: `employee_id`, `work_date`, `shift_name`, `check_in`, `check_out`, `total_hours`, `total_salary`, `status`, `employee_name`. Code implies `attendance_logs`: `employee_id`, `check_in_time`, `check_out_time`, `latitude`, `longitude`, `status`, `hours_worked`, `earnings_today`. | `services/attendanceService.ts`, `app/api/check-in/route.ts`, `app/api/attendance/check-out/route.ts`, `lib/types/attendance.ts` | Code shape is inferable, but authoritative schema is not present in repo. | Medium |
| Which routes write attendance, payroll, or ledger records? | Check-in route inserts `attendance_logs`; check-out route updates `attendance_logs`; attendance service writes `attendance`; admin attendance writes payroll settlement into `financial_ledger`; staff expenses insert `financial_ledger`; capital page writes `financial_ledger`. | `app/api/check-in/route.ts`, `app/api/attendance/check-out/route.ts`, `services/attendanceService.ts`, `app/admin/attendance/page.tsx`, `services/staffExpensesService.ts`, `app/admin/capital/page.tsx` | Writes are split across API routes, services, and UI pages. | High |
| What are current calculation rules? | `calculateHoursFromStrings` rounds duration up to 3-hour blocks and handles overnight by adding 24h. Check-out API uses raw elapsed hours rounded to 2 decimals. Attendance service salary is `Math.round(hours * hourlyRate)`. Admin attendance has metadata/hourly fallback logic; staff profile has separate shift wage by title. | `services/payrollService.ts`, `app/api/attendance/check-out/route.ts`, `services/attendanceService.ts`, `app/admin/attendance/page.tsx`, `services/staffProfileService.ts` | Calculation behavior is inconsistent and must be fixture-locked before refactor. | High |
| Does `next.config.js` enable `productionBrowserSourceMaps`? | `next.config.js` contains only custom webpack setting; no `productionBrowserSourceMaps`. | `next.config.js` | Repository config does not explicitly enable production browser source maps. Deployment still needs artifact check for public `.map` files. | High |
| Which environment variables are referenced? | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_STUDIO_LAT`, `NEXT_PUBLIC_STUDIO_LNG`, `NEXT_PUBLIC_STUDIO_RADIUS_METERS`. | `lib/supabase.ts`, `ultis/supabase/server.ts`, `ultis/supabase/middleware.ts`, `app/api/check-in/route.ts` | Public env naming is inconsistent; studio location config is public. | High |
| Which Supabase clients are imported where? | Many Client Components and services import singleton `supabase` from `lib/supabase`; server routes also import the same singleton; `ultis/supabase/server.ts` and middleware client exist separately. | `app/**`, `services/**`, `lib/supabase.ts`, `ultis/supabase/*` | Client strategy is mixed and not request/session scoped in many server routes. | High |
| Which API routes trust client-submitted identity? | Check-out route trusts body `employeeId`; check-in trusts `qrToken`; admin auth trusts passcode and creates client-readable cookie. | `app/api/attendance/check-out/route.ts`, `app/api/check-in/route.ts`, `app/api/admin/auth/route.ts` | Current API identity handling conflicts with the spec. | High |
| Is production webhook provider/signature known? | Route comment mentions VietQR/Casso/PayOS-style payload but verifies no signature/header/algorithm; grep found no provider contract. | `app/api/payments/webhook/route.ts` | Provider/signature contract is not proven by repository evidence; webhook is deferred/out of scope for this specification. | High |

## 24B. Current Code Conflicts With This Specification

| Conflict | Current behavior | Specification target | Evidence |
|---|---|---|---|
| Admin auth is not session-authoritative | Hard-coded passcode sets client-readable `hq_session_token`; client checks cookie presence. | Supabase Auth or server-verified session; server/RLS permission checks. | `app/api/admin/auth/route.ts`, `app/admin/gatekeeper.tsx` |
| Staff identity is client-token based | Staff flow uses URL/localStorage token and QR token style lookup. | Long-term staff identity derives from verified session and `employees.auth_user_id`. | `app/staff/layout.tsx`, `services/staffPortalService.ts`, `app/api/check-in/route.ts` |
| API trusts client employee identity | Check-out route accepts `employeeId` from request body. | Server derives employee identity from verified session. | `app/api/attendance/check-out/route.ts` |
| Supabase client model is mixed | Client Components, services, and server routes import the same singleton from `lib/supabase.ts`; env key names differ. | Browser, server session, middleware, and privileged server clients have separate owners. | `lib/supabase.ts`, `ultis/supabase/*`, `app/**`, `services/**` |
| Employee relationship uses display names | Finance and workflow write or match `requested_by`, `assignee`, `assignee_name`, or `full_name`. | `employees.id` is FK; names are display snapshots only. | `app/admin/capital/page.tsx`, `services/staffExpensesService.ts`, `app/admin/tasks/page.tsx`, `services/staffTasksService.ts` |
| Attendance source is split | APIs write `attendance_logs`; staff/admin attendance and payroll read/write `attendance`. | Event evidence is source; `attendance` is derived/compatibility until approved migration. | `app/api/check-in/route.ts`, `app/api/attendance/check-out/route.ts`, `services/attendanceService.ts`, `app/admin/attendance/page.tsx` |
| Payroll calculations are inconsistent | Service rounds to 3-hour blocks; check-out API uses raw hours to 2 decimals; UI owns payroll summary and settlement. | Current behavior must be fixture-locked; payroll logic moves to approved owner without unapproved result changes. | `services/payrollService.ts`, `app/api/attendance/check-out/route.ts`, `app/admin/attendance/page.tsx` |
| Payroll/attendance sensitive data can be broadly loaded in frontend | Admin attendance loads employees and all attendance records into client state; finance pages query ledger in client. | Sensitive attendance/payroll data is scoped server-side/RLS and not globally fetched then filtered in frontend. | `app/admin/attendance/page.tsx`, `app/admin/capital/page.tsx` |
| Webhook lacks provider verification | Payment webhook parses payload and mutates records without signature/header/algorithm verification. | Webhook support is deferred/out of scope until a concrete provider or integration contract is approved. | `app/api/payments/webhook/route.ts` |
| RLS/policy coverage is not documented for sensitive tables | Repo migrations only show workflow tables enabling RLS; no policies for employees/attendance/payroll are present in repo evidence. | Sensitive tables need RLS or trusted server authorization model before implementation release. | `supabase/migrations/*` |

## 25. Implementation Order

1. Confirm live schema and deployed environment variable names.
2. Confirm auth/user/employee relationships and current Supabase Auth usage.
3. Build regression fixtures for current attendance/payroll outputs.
4. Define final Supabase client contract and static import boundaries.
5. Define role/permission model and RLS policy plan.
6. Define attendance source-of-truth migration plan with compatibility.
7. Define payroll source-of-truth migration plan with compatibility.
8. Add stable employee relationship columns/tables in an approved migration phase.
9. Backfill stable relationships with conflict reporting.
10. Move calculations into service/domain owners with regression tests.
11. Replace client-trusted auth/session flows.
12. Add audit logging for sensitive operations.
13. Lock down cron routes; leave webhook deferred until a provider or integration contract is approved.
14. Remove or deprecate legacy name-based and client-filtered paths after validation.
15. Run lint, type check, tests, production build, security matrix, and manual verification before release.
