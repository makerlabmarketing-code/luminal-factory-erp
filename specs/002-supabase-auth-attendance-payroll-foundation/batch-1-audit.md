# Batch 1 Foundation Audit

Date: 2026-07-11

Scope: Safe Foundation Task 1, 2, 3, 4, 7, 9, and 10 from `plan.md`.

This audit records current behavior only. It does not approve or make payroll formula changes, attendance behavior changes, schema changes, RLS changes, auth flow changes, UI changes, dependency changes, or migrations.

## Batch 1 Task Mapping

| Plan task ID | Batch 1 work performed |
|---|---|
| Safe Foundation Task 1 | Inventory Supabase client usage, environment variables, and identity inputs. |
| Safe Foundation Task 2 | Audit attendance/payroll formulas and current data sources. |
| Safe Foundation Task 3 | Define fixture design for current behavior. |
| Safe Foundation Task 4 | Add regression-test scaffold that locks current pure calculation behavior and static security boundaries. |
| Safe Foundation Task 7 | Audit sensitive frontend data loading scope. |
| Safe Foundation Task 9 | Audit current RLS/server authorization evidence from repository files. |
| Safe Foundation Task 10 | Check production source-map configuration and public artifacts. |

## Supabase Client Usage Inventory

| File | Runtime context | Supabase entrypoint | Tables or purpose | Finding |
|---|---|---|---|---|
| `lib/supabase.ts` | Shared import used by browser, services, and server routes | `createBrowserClient`, `createClient`, exported `supabase` singleton | Base client factory | Browser singleton is exported broadly; server helper uses anon key without request session context. |
| `ultis/supabase/client.ts` | Browser helper | Re-export of `createBrowserSupabaseClient` | Browser client | Thin wrapper around `lib/supabase.ts`. |
| `ultis/supabase/server.ts` | Server helper | `createServerClient` from `@supabase/ssr` | Cookie-aware server client | Uses `NEXT_PUBLIC_SUPABASE_ANON_KEY`; separate from most route/service usage. |
| `ultis/supabase/middleware.ts` | Middleware helper | `createServerClient` from `@supabase/ssr` | Session refresh/update cookies | Uses `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, creating env naming drift. |
| `services/emailService.ts` | Server/service | `createServerSupabaseClient` from `lib/supabase.ts` | settings, templates, history, attendance, employees, shifts | Server work uses anon-key client, not request-scoped user session. |
| `services/repositories/workflowRepository.ts` | Service | `supabase` singleton | projects, phases, tasks | Service imports browser singleton. |
| `services/employeeService.ts` | Service | `supabase` singleton | employees | Service imports browser singleton. |
| `services/attendanceService.ts` | Service | `supabase` singleton | attendance | Service imports browser singleton. |
| `services/staffPortalService.ts` | Service | `supabase` singleton | employees, system_metadata | Token-based staff lookup through browser-compatible client. |
| `services/staffProfileService.ts` | Service | `supabase` singleton | employees | Staff update uses caller-supplied employee ID. |
| `services/staffExpensesService.ts` | Service | `supabase` singleton | financial_ledger | Staff expenses keyed by employee full name. |
| `app/staff/attendance/AttendanceView.tsx` | Client Component | `supabase` singleton | employees, attendance, facilities | Client reads staff profile, attendance, and facilities directly. |
| `app/admin/facilities/page.tsx` | Client Component | `supabase` singleton | facilities | Admin data mutation from client. |
| `app/admin/metadata/page.tsx` | Client Component | `supabase` singleton | system_metadata | Admin metadata mutation from client. |
| `app/admin/settings/page.tsx` | Client Component | `supabase` singleton | system_metadata, system_settings | Admin settings loaded/mutated from client. |
| `app/admin/email-editor/page.tsx` | Client Component | `supabase` singleton | email_templates, system_metadata | Email template data loaded/mutated from client. |
| `app/admin/email-history/page.tsx` | Client Component | `supabase` singleton | email_history | Email history loaded from client. |
| `app/admin/dashboard/page.tsx` | Client Component | `supabase` singleton | financial_ledger | Finance data loaded from client. |
| `app/admin/employees/page.tsx` | Client Component | `supabase` singleton | employees, facilities | Full employee records loaded/mutated from client. |
| `app/admin/attendance/page.tsx` | Client Component | `supabase` singleton | system_metadata, employees, shifts, attendance, financial_ledger | Attendance and payroll summary/settlement run in client. |
| `app/admin/capital/page.tsx` | Client Component | `supabase` singleton | employees, system_metadata, system_settings, financial_ledger | Finance and employee bank lookup loaded from client. |
| `app/api/payments/webhook/route.ts` | Route Handler | `supabase` singleton | financial_ledger or payment mutation | Webhook is deferred/out of scope for this spec. |
| `app/api/attendance/check-out/route.ts` | Route Handler | `supabase` singleton | attendance_logs, employees | Trusts frontend `employeeId`; uses anon client. |
| `app/api/cron/monthly-payroll/route.ts` | Route Handler | `createServerSupabaseClient` | employees, email | Cron endpoint has no scheduler secret check in repo evidence. |
| `app/api/cron/attendance-checkout-reminder/route.ts` | Route Handler | service calls `createServerSupabaseClient` | attendance, employees, shifts, email | Cron endpoint has no scheduler secret check in repo evidence. |
| `app/api/check-in/route.ts` | Route Handler | `supabase` singleton | employees, attendance_logs | Trusts QR token as identity bootstrap; uses public studio env vars. |

## Environment Variable Inventory

| Variable | Current classification | Current usage | Notes |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Public | `lib/supabase.ts`, `ultis/supabase/server.ts`, `ultis/supabase/middleware.ts` | Expected public Supabase project URL. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public | `lib/supabase.ts`, `ultis/supabase/server.ts` | Used for browser and server helper. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public | `ultis/supabase/middleware.ts` | Naming drift from anon key usage. |
| `NEXT_PUBLIC_STUDIO_LAT` | Public operational config | `app/api/check-in/route.ts` | Used server-side but public by prefix. Not a credential, but exposes studio coordinate. |
| `NEXT_PUBLIC_STUDIO_LNG` | Public operational config | `app/api/check-in/route.ts` | Used server-side but public by prefix. Not a credential, but exposes studio coordinate. |
| `NEXT_PUBLIC_STUDIO_RADIUS_METERS` | Public operational config | `app/api/check-in/route.ts` | Used server-side but public by prefix. Not a credential. |
| `SUPABASE_SERVICE_ROLE_KEY` | Privileged | No production code reference found. | Static test scaffold checks this remains absent from browser/client graph. |
| SMTP settings | Server-only data in database | `services/emailService.ts` reads `system_settings` keys `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM_NAME` | Stored in Supabase table, not environment variables. Sensitive if loaded through client-accessible settings UI. |
| Cron secret | Server-only | No current env var found. | Cron routes currently do not verify an approved scheduler secret in repo evidence. |

## Identity Flow Inventory

| Identity input | Current path | Current authority | Risk |
|---|---|---|---|
| Auth session | `ultis/supabase/server.ts`, `ultis/supabase/middleware.ts` support cookie-aware clients, but most routes/services do not use them | Partial/unused in audited flows | Mixed auth source; most sensitive flows are not session-authoritative. |
| Admin passcode | `app/api/admin/auth/route.ts` hard-codes `LF2026@` | Request body checked by route | Critical: privileged secret in source code. |
| Admin cookie | `hq_session_token` set by `app/api/admin/auth/route.ts`; read by `app/admin/gatekeeper.tsx` through `document.cookie` | Browser-readable cookie | Critical: client-readable cookie is treated as admin gate. |
| Staff URL token | `app/staff/layout.tsx`, staff views, `StaffPortalContent` | `token` query param | Critical: long-lived identity in URL. |
| Staff localStorage token | `app/staff/layout.tsx` | `current_staff_token` | Critical: long-lived identity in localStorage. |
| QR token | `app/api/check-in/route.ts`, `services/staffPortalService.ts` | `employees.qr_token` | High: token lookup directly grants staff identity and profile access. |
| Frontend `employeeId` | `app/api/attendance/check-out/route.ts` body; staff attendance service calls use `activeWorker.id`; modal uses selected employee ID | Client-provided ID | Critical for checkout route; no server-derived employee identity. |
| Frontend role | `app/admin/employees/page.tsx` form can set employee `role`; cron queries role | Client form input | High: role mutation is client-side admin UI gated only by current admin cookie flow. |
| `userId` | No current authoritative Supabase Auth user mapping found in repo evidence | Not implemented | Medium: no stable auth-user to employee mapping in repo evidence. |

## Attendance And Payroll Calculation Audit

### Current Formulas Found

| Formula | Code location | Input | Output | Current behavior |
|---|---|---|---|---|
| Shift-block worked hours | `services/payrollService.ts` `calculateHoursFromStrings` | `timeInStr`, `timeOutStr` | Number of hours | Uses dummy date `2026-01-01`, truncates inputs to `HH:mm`, adds 24h for negative diff, returns `ceil(rawHours / 3) * 3`, returns 0 for missing/nonpositive duration. |
| Salary | `services/payrollService.ts` `calculateSalary` | `decimalHours`, `hourlyRate` | Integer salary | Returns 0 if hours or rate <= 0; otherwise `Math.round(decimalHours * hourlyRate)`. |
| Shift units | `services/attendanceService.ts` `calculateShiftUnitsFromHours` | Hours | Shift count | Returns 0 if hours <= 0; otherwise `Math.ceil(hours / 3)`. |
| Attendance hourly rate fallback | `services/attendanceService.ts` `getEmployeeHourlyRate` | Employee | Hourly rate | `Number(employee.hourly_rate || employee.base_salary_per_hour || 30000)`. |
| Admin payroll hourly rate | `app/admin/attendance/page.tsx` `getHourlyRateByTitle` | Employee title, `system_metadata` salary data | Hourly rate | Matches title to metadata `key` or `level`, returns `value` or `rate`, fallback `30000`. |
| Admin payroll summary | `app/admin/attendance/page.tsx` `calculatePayrollFromRecords` | Attendance records, employees, salary metadata | Total shifts, total hours, total wage | Merges records, skips incomplete records, uses `record.total_hours` if present else shift-block formula, then salary formula. |
| Staff attendance history display | `app/staff/attendance/AttendanceView.tsx` | Attendance records | Display hours | Uses `record.total_hours` if present else shift-block formula. |
| Attendance log checkout elapsed hours | `app/api/attendance/check-out/route.ts` | Current time minus `attendance_logs.check_in_time` | `hours_worked` | Uses raw elapsed milliseconds, converts to hours, rounds to 2 decimals using `toFixed(2)`, rejects <= 0. |
| Attendance log checkout earnings | `app/api/attendance/check-out/route.ts` | `hoursWorked`, `employees.hourly_rate` | `earnings_today` | Uses `employee.hourly_rate || 30000`, then `Math.round(hoursWorked * hourlyRate)`. |
| Staff profile shift wage | `services/staffProfileService.ts` `getShiftWageByTitle` | Employee title | Shift wage | Returns `150000` for title `A1`, otherwise `100000`; not used by audited payroll settlement path. |
| Payroll payment period | `app/admin/attendance/page.tsx` `getPayrollPaymentPeriod` | Work month/year | Ledger month period | Adds one business month and formats business month period. |
| Capital/finance period | `app/admin/capital/page.tsx` `convertToPeriodFormat` | Browser month input `YYYY-MM` | `MM/YYYY` | Calendar-month formatting, not business-month helper. |

### Duplicate Or Conflicting Formulas

| Code location | Input | Output | Difference | Data used | Affected user flow | Proposed source of truth |
|---|---|---|---|---|---|---|
| `services/payrollService.ts` vs `app/api/attendance/check-out/route.ts` | Check-in/out times | Worked hours | Payroll service rounds up to 3-hour blocks; checkout API stores actual elapsed hours rounded to 2 decimals. | `attendance.check_in/check_out` vs `attendance_logs.check_in_time/check_out_time` | Staff attendance toggle/admin payroll vs API QR checkout flow | Do not choose in Batch 1; requires audit approval. |
| `services/attendanceService.ts` vs `app/admin/attendance/page.tsx` | Employee wage data | Hourly rate | Service uses employee `hourly_rate` or `base_salary_per_hour`; admin payroll uses salary metadata matched by title. | `employees` columns vs `system_metadata` salary category | Staff attendance writes vs admin payroll summary/settlement | Do not choose in Batch 1; requires audit approval. |
| `services/staffProfileService.ts` vs payroll settlement path | Employee title | Wage/rate | Staff profile exposes shift wage 150000/100000; admin payroll calculates hourly wage from metadata and worked hours. | Hard-coded title wage vs metadata hourly rate | Staff profile display vs payroll settlement | Do not choose in Batch 1; requires audit approval. |
| `app/admin/attendance/page.tsx` vs `app/admin/capital/page.tsx` | Payroll/finance period | Ledger period string | Payroll settlement uses approved business month helper and pays next month; capital uses simple `MM/YYYY` conversion. | Business-date module vs raw month input | Payroll settlement vs finance ledger views | Do not choose in Batch 1; requires product/date approval. |

## Current Source Of Truth Table

| Domain | Current observed source | Current readers/writers | Gaps |
|---|---|---|---|
| `attendance_logs` | Event-like check-in/check-out log table | `app/api/check-in/route.ts` inserts; `app/api/attendance/check-out/route.ts` updates | Not read by admin payroll; identity from QR/frontend employee ID; raw elapsed formula differs from payroll service. |
| `attendance` | Admin/staff attendance record and payroll input table | `services/attendanceService.ts`, `app/admin/attendance/page.tsx`, `app/staff/attendance/AttendanceView.tsx`, email checkout reminder | Used as payroll input and UI history; can be manually edited/deleted from client-gated admin flow. |
| Payroll | Derived in `app/admin/attendance/page.tsx` from `attendance`, employees, and metadata; settlement writes `financial_ledger` | Admin attendance page | No payroll run/line table in repo evidence; UI owns settlement loop; results are not reproducible from dedicated payroll records. |
| Wage/rate | Mixed: `system_metadata` salary data, `employees.hourly_rate`, `employees.base_salary_per_hour`, hard-coded staff profile shift wage | Admin attendance, attendance service, check-out API, staff profile | Multiple sources conflict; no append-only wage/rate history found. |
| Adjustments | No dedicated payroll adjustment source found in repo evidence | Finance ledger can contain general entries, expenses, settlement records | Payroll adjustments are not modeled as approved payroll inputs in current code. |
| Payroll periods | Business-date month in admin attendance; raw `MM/YYYY` in capital/finance; current month helper in financial service | Admin attendance, capital, staff expenses | Period logic is split; payroll payment period adds one business month before ledger settlement. |

## Sensitive Frontend Data Scope Audit

| File | Data loaded in frontend | Risk |
|---|---|---|
| `app/admin/employees/page.tsx` | `employees.select('*')`, including bank, identity, role, QR token-related fields if present | Critical if admin gate is bypassed; sensitive employee data loaded broadly. |
| `app/admin/attendance/page.tsx` | all attendance records, employees, shifts, salary metadata; payroll summary calculated in client | Critical for payroll/attendance exposure and UI-owned payroll math. |
| `app/admin/capital/page.tsx` | all employees, system metadata/settings, monthly financial ledger | High: finance records and employee bank data used client-side. |
| `app/admin/settings/page.tsx` | system settings | High: may expose operational secrets if settings contain SMTP or future secrets. |
| `app/admin/metadata/page.tsx` | all system metadata | Medium: controls salary metadata and operational categories in client. |
| `app/staff/attendance/AttendanceView.tsx` | employee profile by token, attendance records for employee ID, facilities | High: token-derived identity and client-side query boundaries. |
| `services/staffExpensesService.ts` | staff ledger records matched by `requested_by = full_name` | High: name-based financial relationship; relies on RLS/server boundaries not evidenced in repo. |

## RLS And Server Authorization Evidence

Repository migrations only include workflow/colorway migrations:

- `supabase/migrations/20260704153000_move_workflow_to_project_tables.sql`
- `supabase/migrations/20260709110000_add_colorway_stage_fields.sql`

No repository migration evidence was found for employees, attendance, attendance logs, payroll, wage/rate, finance ledger, staff portal, auth-user mapping, or policies protecting sensitive payroll/attendance tables. Live database policy state still requires a separate schema/RLS audit.

## Production Source Map Status

| Check | Result |
|---|---|
| `next.config.js` | No `productionBrowserSourceMaps` key present, so repository config does not explicitly enable production browser source maps. |
| `public/**/*.map` | No public `.map` files found. |
| `.next/**/*.map` in local build artifact | No `.map` files found in current local `.next` tree. |

No source-map configuration change was made.

## Security Findings

### Critical

- Admin auth passcode is hard-coded in `app/api/admin/auth/route.ts`.
- Admin session gate trusts browser-readable `hq_session_token` in `app/admin/gatekeeper.tsx`.
- Staff portal uses URL token and localStorage token as long-term identity in `app/staff/layout.tsx`.
- `app/api/attendance/check-out/route.ts` trusts frontend-submitted `employeeId` for attendance log mutation.
- Sensitive employee, attendance, payroll, and finance data are loaded in Client Components behind a client-readable admin gate.

### High

- Supabase client usage is mixed: the same browser-compatible singleton is imported by Client Components, services, and server routes.
- Attendance source is split between `attendance_logs` and `attendance`.
- Payroll formulas conflict between shift-block rounding and raw elapsed-hours calculation.
- Wage/rate sources conflict across employee columns, salary metadata, and hard-coded staff profile shift wage.
- Finance/staff expense relationships use `requested_by = full_name`.
- Workflow/staff task assignment still falls back to `assignee_name`, `assignee`, and full-name matching.
- Cron routes have no scheduler secret verification in repo evidence.
- Settings and metadata are mutated from Client Components; SMTP settings are stored in `system_settings`.
- RLS/policy coverage for sensitive tables is absent from repository evidence.

### Medium

- `NEXT_PUBLIC_STUDIO_LAT`, `NEXT_PUBLIC_STUDIO_LNG`, and `NEXT_PUBLIC_STUDIO_RADIUS_METERS` expose studio location configuration by public prefix.
- Supabase public key naming is inconsistent between `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- Staff profile update accepts caller-supplied `employeeId`.
- Employee role mutation occurs from client-side admin UI.
- Production source-map config is safe in repo evidence, but deployed artifacts still need release verification.

### Low

- Several frontend pages use broad `select('*')` where narrower column lists would reduce accidental exposure.
- No dedicated test fixture owner existed before Batch 1.

## Fixture Design Summary

The Batch 1 fixture scaffold locks the pure current behavior in `services/payrollService.ts`:

- missing time returns 0 hours;
- equal in/out time returns 0 hours;
- one-minute work interval rounds to 3 hours;
- exactly 3 hours remains 3 hours;
- 3 hours and 1 minute rounds to 6 hours;
- overnight intervals add 24 hours and round to 3-hour blocks;
- salary uses `Math.round(hours * hourlyRate)`;
- nonpositive hours or rate returns 0.

Fixtures intentionally do not choose between conflicting payroll formulas.

