# Batch 3B Identity Schema Draft, Backfill Plan, and RLS Policy Draft

Date: 2026-07-12

Scope: design and draft artifacts plus read-only verification. Read-only metadata/validation SQL was run. No mutating SQL was run, no migration was created under `supabase/migrations`, no production schema changed, no RLS was enabled or modified, no bucket was created, no data was backfilled, no application code changed, and payroll/attendance calculations were not changed.

## 1. Approved Decisions Applied

| Decision area | Applied decision |
|---|---|
| Read-only metadata access | Use Supabase CLI, MCP, or database connection with read-only permissions to inspect `auth.users`, columns, indexes, constraints, RLS, policies, storage, and migration history. Do not use service role only for metadata audit. |
| Compatibility role source | `employees.role` may be used in first RLS rollout only as a temporary compatibility source derived from authenticated identity. It is not the final authorization model. |
| Permission roadmap | Future model must support `roles`, `permissions`, `role_permissions`, `user_roles` or `employee_roles`, and record-level scope. |
| Sensitive policies | Payroll, finance, HR documents, and audit access must not be broadly opened by a vague role. They need explicit permission/scope before broad rollout. |
| Staff documents | HR confidential documents are private and visible only to Owner/Admin with appropriate permission. Staff may see only self-service document types belonging to themselves. |
| Expense files | Staff expense file storage migration is deferred to a later batch. This batch records compatibility risk and dependencies only. |
| Normalized email uniqueness | A partial unique index on `lower(trim(email))` is allowed only if verification proves data is clean. Otherwise defer and produce a validation report. |
| Migration rollout | Split into Step 1 nullable column/FK, Step 2 dry-run mapping, Step 3 backfill certain cases, Step 4 indexes after validation, Step 5 staged RLS policies. |

## 2. Draft Artifacts

| Artifact | Purpose |
|---|---|
| `drafts/identity-auth-user-id-migration.sql` | Staged identity migration draft. |
| `drafts/identity-auth-user-id-rollback.sql` | Rollback draft for identity column, indexes, backfill, and policy helper cleanup. |
| `drafts/identity-validation-queries.sql` | Read-only validation, duplicate email audit, duplicate employee code audit, auth-user mapping dry-run, RLS/storage/migration metadata queries. |
| `drafts/rls-compatibility-policy-draft.sql` | Compatibility RLS helper/policy draft using `employees.role` as temporary source. |

These files are not runnable production migrations and are intentionally outside `supabase/migrations`.

## 3. Metadata Verification Status

Current workspace status after Supabase CLI link:

| Check | Status |
|---|---|
| Supabase public env | Present. Values not printed. |
| `.env.local` | Git ignored. |
| Project ref | `kwfmfmpgpbfewpiizesv` |
| Read-only SQL connection | Available through `npx supabase db query --linked`. |
| Supabase CLI | Available through `npx supabase`, version `2.109.1`. |
| Supabase MCP SQL | Not exposed in current toolset. |
| Public REST/OpenAPI metadata | Not used for database metadata verification. |
| `auth.users` authoritative audit | Verified count only: `0`. |
| RLS/policy catalog | Verified through `pg_class` and `pg_policies`. |
| Storage policy catalog | Verified through `storage.buckets` and `pg_policies`. |

Readiness consequence after verification:

- Migration remains **Not Ready** because `auth.users` has 0 users, `employees.auth_user_id` is absent, and `employees.employee_id` is absent from live schema despite the approved target business-code requirement.
- RLS remains **Not Ready** for rollout because identity mapping cannot work until `auth_user_id` exists and users are provisioned.
- Storage remains **Not Ready** because no buckets exist and no storage policies exist.

## 3A. Live Schema Evidence

| Resource | Live evidence |
|---|---|
| `auth.users` | `0` users. |
| `employees` row count | `5`. |
| `employees.auth_user_id` | Absent. |
| `employees.employee_id` | Absent. This conflicts with the approved target that it remains a business code. Adding it is a separate schema decision and is not included in the identity migration draft. |
| `employees.email` | Present, `NOT NULL`, raw unique constraint/index `employees_email_key`. |
| `employees.id` | Present, bigint primary key. |
| `employees.qr_token` | Present, raw unique constraint/index `employees_qr_token_key`. |
| Duplicate `employee_id` | Not applicable because column is absent. |
| Duplicate `lower(trim(email))` | None found. |
| Employee missing email | Internal employee id `6`. |
| Certain auth-email mapping | `0` because `auth.users` has 0 users. |
| Employees without auth user | `5` employee rows. |
| Auth users without employee | `0` because there are no auth users. |

Live sensitive table evidence:

| Table | Exists | RLS enabled | Columns summary |
|---|---:|---:|---|
| `employees` | Yes | Yes | `id`, `full_name`, `title`, `hourly_rate`, `qr_token`, `email`, status/role/bank/branch/contact fields. No `auth_user_id`; no `employee_id`. |
| `attendance` | Yes | Yes | `employee_id`, work/check-in/out/status/total fields. |
| `attendance_logs` | Yes | Yes | `employee_id`, check-in/out, hours, earnings, location, shift fields. |
| `financial_ledger` | Yes | Yes | `requested_by`, amount/category/type/month/payment/bill fields. No stable employee FK. |
| `projects` | Yes | Yes | `project_name`, `drive_url`, `status`, timestamps. |
| `phases` | Yes | Yes | `project_id`, `name`, `order_index`, timestamps. |
| `tasks` | Yes | Yes | `project_name`, `assigned_to`, `current_phase`, estimation/issue/packer fields. No stable assignee ID. |
| `facilities` | Yes | Yes | facility name/location/radius fields. |
| `system_metadata` | Yes | Yes | settings metadata JSON. |
| `system_settings` | Yes | Yes | key/value/config/group fields. |
| `attendance_corrections`, `payroll*`, `wage_rate_history`, `adjustments`, `expenses`, `project_members`, `audit_logs`, `file_metadata` | No | N/A | Not present. |

Live row counts: `employees=5`, `attendance=31`, `attendance_logs=3`, `financial_ledger=64`, `projects=2`, `tasks=2`, `system_settings=7`.

## 3B. Live RLS and Policy Coverage

| Resource | RLS | Policy status | Risk |
|---|---|---|---|
| `employees` | Enabled | No policy found. | Default deny through Data API; app needs server-side access until policies exist. |
| `attendance` | Enabled | No policy found. | Default deny; own-record policy can be first safe candidate after identity migration. |
| `attendance_logs` | Enabled | No policy found. | Default deny; own-record policy can be first safe candidate after identity migration. |
| `financial_ledger` | Enabled | No policy found. | Default deny; finance policies must wait for stable employee relation/permissions. |
| `projects` | Enabled | No policy found. | Default deny; repo migration policy history does not match live policy catalog. |
| `phases` | Enabled | No policy found. | Default deny; repo migration policy history does not match live policy catalog. |
| `tasks` | Enabled | No policy found. | Default deny; no stable assignee ID, so scoped policy must wait. |
| `system_settings` | Enabled | `ALL` for `anon` and `authenticated` using/check `true`. | High risk: public/authenticated full access to settings. Needs separate remediation. |
| `facilities`, `system_metadata` | Enabled | No policy found. | Default deny through API. |

Policy definitions currently found:

- `system_settings`: `Allow anon all`, command `ALL`, role `anon`, `using true`, `with check true`.
- `system_settings`: `Allow authenticated all`, command `ALL`, role `authenticated`, `using true`, `with check true`.

No storage policies were found.

## 3C. Live Storage Evidence

| Bucket evidence | Result |
|---|---|
| `storage.buckets` count | `0` |
| Public buckets | None |
| Private buckets | None |
| `storage.objects` / `storage.buckets` policies | None |

No bucket can be classified for HR/payroll/project/source assets yet because no buckets exist.

## 3D. Migration Drift Report

`npx supabase migration list --linked` returned:

| Version | Local | Remote |
|---|---:|---:|
| `20260704153000` | Present | Absent |
| `20260709110000` | Present | Absent |

Live database nevertheless contains `projects`, `phases`, and `tasks`, but their live columns/policies differ from the repo migration expectations:

- repo migration creates/updates workflow schema and permissive policies;
- remote migration history does not show those versions;
- live `projects/phases/tasks` exist;
- live policies for `projects/phases/tasks` are absent;
- live `phases` lacks the colorway/stage fields from `20260709110000_add_colorway_stage_fields.sql`.

Conclusion: there is schema drift between repository migrations and live database history/schema. Migration readiness stays **Not Ready** until drift is reconciled or accepted with a repair/pull plan.

## 4. Schema Diff

Identity migration target:

```sql
alter table public.employees
  add column if not exists auth_user_id uuid null;

alter table public.employees
  add constraint employees_auth_user_id_fkey
  foreign key (auth_user_id)
  references auth.users(id)
  on delete set null;
```

Conditional indexes:

```sql
create unique index concurrently if not exists employees_auth_user_id_unique_not_null
  on public.employees (auth_user_id)
  where auth_user_id is not null;
```

```sql
create unique index concurrently if not exists employees_normalized_email_unique_not_blank
  on public.employees ((lower(trim(email))))
  where email is not null
    and nullif(trim(email), '') is not null;
```

Rules:

- `employees.id` remains the internal primary key and relationship key.
- `employees.employee_id` remains a business code for display, search, import/export, and reconciliation.
- `employees.employee_id` is not the primary key and not the main foreign key.
- `full_name` is display-only.
- `employees.auth_user_id` is nullable for employees without auth accounts.
- Normalized email uniqueness is optional and must be deferred if duplicate/shared/placeholder data exists.

## 5. Migration Rollout Plan

| Step | Action | Gate |
|---|---|---|
| Step 1 | Add nullable `employees.auth_user_id`; add FK if validation confirms safe. | Read-only column/constraint validation complete. |
| Step 2 | Dry-run mapping and classify certain/manual/impossible cases. | `auth.users` and `employees` read-only audit complete. |
| Step 3 | Backfill certain mappings only. | Explicit approval of affected employee IDs. |
| Step 4 | Add unique index for `auth_user_id`; add normalized email unique index only if data is clean. | No duplicate/orphan auth links; duplicate email audit clean. |
| Step 5 | Roll out RLS table-by-table. | Identity mapping verified; rollback per policy group prepared. |

Policy rollout must not happen in one broad change. Start with own-record read policies where schema and app behavior are already compatible.

## 6. Mapping Plan

Canonical identity path:

```text
auth.uid()
-> auth.users.id
-> employees.auth_user_id
-> employees.id
-> compatibility role / future permission / record scope
```

Mapping categories:

| Category | Criteria | Action |
|---|---|---|
| Map chắc chắn | Exactly one normalized employee email equals exactly one normalized auth user email; no conflicting `auth_user_id`. | Eligible for approved backfill. |
| Cần kiểm tra thủ công | Duplicate employee email, duplicate auth email, existing conflicting link, shared mailbox, placeholder email, uncertain account ownership. | Do not auto-map; review masked list. |
| Không thể map | Employee lacks email, no matching auth user, auth user lacks employee, or owner cannot confirm. | Leave null; handle account provisioning/manual link later. |

Manual data that must be reviewed after validation:

- duplicate `employee_id`;
- duplicate normalized employee email;
- emails changed by case/space normalization;
- placeholder/shared emails;
- employees without email;
- duplicate auth user email;
- auth users without employees;
- employees without auth users;
- existing `auth_user_id` values that do not match normalized email.

## 7. RLS Compatibility Matrix Using `employees.role`

Compatibility rule:

`employees.role` may be read only after `auth.uid()` maps to `employees.auth_user_id`. It must never come from frontend state, request body, URL, localStorage, or sessionStorage.

| Resource | Safe first policy | Compatibility role use | Must wait for full permission model |
|---|---|---|---|
| `employees` | Staff can select own row. | Owner/Admin may view broader rows temporarily if approved. | HR confidential fields need field/server filtering and explicit HR permission. |
| `attendance` | Staff can select own rows. | Admin/Owner/Attendance role may manage after explicit approval. | Team/branch scope needs record-scope model. |
| `attendance_logs` | Staff can select own logs. | Admin/Owner/Attendance role may view after approval. | Location/event mutation should stay server-mediated. |
| `attendance_corrections` | Staff own requests; approver scoped. | Admin/Owner can administer temporarily. | Approval workflow and no-self-approval need explicit tables. |
| `projects` | Assigned/member scoped when `project_members` exists. | Owner/Admin can manage all temporarily. | Project Manager scope needs `project_members`. |
| `tasks` | Assignee/reviewer own scope. | Owner/Admin can manage all temporarily. | Reviewer/project membership needs stable IDs. |
| `project_members` | Member own memberships. | Owner/Admin manage. | Required before scoped project access. |
| `payroll_runs` | None safe using generic role only. | Avoid broad compatibility grant. | Requires explicit payroll permission. |
| `payroll_items` | Staff own approved payslip only after schema exists. | Avoid broad compatibility grant. | Payroll/Admin permission and run state required. |
| `wage_rate_history` | None for staff raw access. | Avoid broad compatibility grant. | Requires payroll/HR permission and audit. |
| `adjustments` | Staff own requests only if schema supports it. | Avoid broad compatibility grant. | Requires approval workflow. |
| `financial_ledger` / expenses | Staff own expense rows only after stable `employee_id` exists. | Avoid finance-wide role grant. | Finance permission and stable employee relation required. |
| `audit_logs` | Server append only. | Do not grant via role alone. | Requires audit permission. |
| `file_metadata` | Own/self-service docs only by type. | Owner/Admin for HR confidential only with permission. | Full storage/file permission model required. |

Policies that can be considered first:

- `employees` own-row select;
- `attendance` own-row select;
- `attendance_logs` own-row select;
- `tasks` own assigned select if stable assignee ID exists;
- deny-by-default for missing payroll/finance/audit tables until permission model exists.

Policies that must wait:

- payroll all-employee access;
- finance-wide access;
- HR confidential documents;
- audit log read access;
- storage object policies for payroll/staff/source assets;
- project manager scoped access until `project_members` exists.

## 8. Target Permission Model Roadmap

The first identity migration should not create the full authorization schema unless separately approved. The target model should support:

- `roles`
- `permissions`
- `role_permissions`
- `employee_roles` or `user_roles`
- `employee_permissions`
- `record_scopes`
- `project_members`
- `audit_logs`

Target permission examples:

| Permission | Resource scope |
|---|---|
| `employees.view_sensitive` | all, branch, own |
| `attendance.view` | own, branch, team, all |
| `attendance.manage` | branch, all |
| `payroll.view_own` | own |
| `payroll.view_all` | all or payroll group |
| `payroll.manage` | payroll group, all |
| `finance.view` | all, category, project |
| `finance.manage` | all, category |
| `projects.manage` | project, all |
| `tasks.review` | assigned review, project |
| `audit.view` | all |
| `files.hr_confidential.view` | all or approved HR scope |

## 9. Storage Access Matrix

| Category | Bucket | Visibility | Access model | Notes |
|---|---|---|---|---|
| HR confidential | Private staff-documents or hr-documents | Private | Owner/Admin with explicit HR permission only; signed URL short TTL or server-mediated. | Payroll/Finance do not get default access. |
| Payroll files | Private payroll-files | Private | Staff own approved payslip; Payroll permission for scoped access. | No public URL. |
| Attendance attachment | Private attendance-attachments | Private | Employee own request; approver/Admin scoped. | Tie to correction/event metadata. |
| Employee self-service | Private staff-documents | Private | Staff own document if type is self-service allowed. | No cross-employee access. |
| Internal administrative | Private admin-documents | Private | Owner/Admin permission. | Not staff self-service by default. |
| Invoices | Private finance-files | Private by default | Finance/Admin scoped; requester own only if approved. | Expense file migration deferred. |
| Project source files | Private project-files | Private | Project member/manager/Admin scoped. | Requires `project_members`. |
| STL/source | Private source-assets | Private | Production/project permission. | Never public before approved release. |
| Unreleased artwork | Private artwork-assets | Private | Content/project permission. | No guessable URLs. |
| Production formulas | Private production-formulas | Private | Owner/Admin/Production permission. | High sensitivity. |

Storage requirements:

- Sensitive buckets must be private.
- Signed URLs must be short-lived.
- Server-mediated access must check authenticated identity, employee mapping, permission, and record scope.
- Access must not rely on guessable paths or frontend role state.
- `storage.objects` policies must validate bucket ID and stable path/scope metadata.

## 10. Deferred Scope

Deferred from this Batch 3B draft:

- staff expense file storage migration;
- creating buckets;
- changing bucket visibility;
- creating full permission tables;
- creating payroll source-of-truth tables;
- creating attendance correction workflow tables;
- switching finance from `requested_by` to stable `employee_id`;
- enabling/tightening RLS;
- backfilling `auth_user_id`;
- adding normalized email unique index if data is not clean;
- adding `employee_id` unique index until import/export workflows and duplicate audit are verified.

Compatibility finding:

- If current expense files are stored as public URLs or direct uncontrolled links, this is a separate security finding. Temporary mitigation should be server-side access checks and avoiding new public uploads until the storage migration batch is approved.

## 11. Readiness

| Area | Status | Reason |
|---|---|---|
| Migration readiness | Not Ready | Live `auth.users` has 0 users, `employees.auth_user_id` is absent, `employees.employee_id` is absent, and repository migration history drifts from remote. Step 1 SQL can be reviewed, but execution should wait for drift and account bootstrap decisions. |
| RLS readiness | Not Ready | RLS is enabled on sensitive live tables, but identity mapping cannot work yet. `system_settings` has broad `ALL` policies for `anon` and `authenticated` and needs separate remediation. |
| Storage readiness | Not Ready | No storage buckets or policies exist. Storage design is ready for review, but implementation requires bucket creation and policy approval in a later batch. |

## 12. Non-Actions Confirmed

- No mutating SQL was run. Only read-only metadata/validation SQL was run.
- No schema was changed.
- No migration was created under `supabase/migrations`.
- No RLS policy was enabled, disabled, created, or modified.
- No bucket was created.
- No data was backfilled.
- No application code was changed.
- No payroll calculation changed.
- No attendance calculation changed.
