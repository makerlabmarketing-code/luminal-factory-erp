# Batch 3C1 Migration Drift Resolution and Identity Bootstrap Plan

Date: 2026-07-12

Scope: read-only verification and planning only. No migration was created, no
`supabase db push`, `supabase migration up`, `supabase db reset`, or
`supabase migration repair` command was run. No DDL, DML, RLS change, auth user
creation, bucket change, production data change, application code change, or
payroll/attendance calculation change was performed.

## 1. Verification Inputs

| Source | Evidence |
|---|---|
| Linked project ref | `kwfmfmpgpbfewpiizesv` |
| Local migrations | `20260704153000_move_workflow_to_project_tables.sql`; `20260709110000_add_colorway_stage_fields.sql` |
| Remote migration history | Both local versions are absent from remote history. |
| Metadata access | `npx supabase db query --linked` read-only SELECTs. |
| CLI version | Supabase CLI `2.109.1`. |

No secrets, keys, full emails, tokens, cookies, or salary records were printed.

## 2. Migration Drift Root Cause

The exact dashboard/manual source cannot be proven from Postgres catalog
metadata alone. PostgreSQL records the current schema state and migration ledger,
but not whether a table was created through the Supabase dashboard, SQL editor,
CLI query, or another external process.

Evidence strongly indicates out-of-band schema changes:

- remote migration history has no entries for the two repository migrations;
- live database contains workflow-like tables (`projects`, `phases`, `tasks`);
- live workflow table shapes do not match the repository migrations;
- live workflow policies do not match the repository migrations;
- live `phases` lacks the colorway/stage columns from the second repository
  migration.

Working root cause: schema was created or edited outside the repository migration
ledger, or the migration ledger was lost/repaired incorrectly. Do not create the
identity migration until this drift is explicitly resolved or accepted.

## 3. Local/Remote Migration Matrix

| Migration version | Local status | Remote status | Related schema objects | Drift level | Proposed handling | Risk |
|---|---|---|---|---|---|---|
| `20260704153000` | Present | Absent | `projects`, `phases`, `tasks`, workflow grants/policies, workflow data copied from `system_settings` | High | Do not run as-is. Compare live workflow data and app expectations. Either create a drift reconciliation migration or repair history only after proving equivalent effects were already applied. | Running as-is may add columns/policies and mutate data unexpectedly. Repairing without equivalence hides real drift. |
| `20260709110000` | Present | Absent | `phases` colorway/stage runtime fields and index | High | Do not repair as applied because live `phases` lacks these columns/index. Create a future approved migration or reconcile after workflow schema decision. | Repairing as applied would make future migration tooling believe missing columns exist. |
| Remote-only migrations | None observed | N/A | N/A | None observed | No action. | N/A |
| Live schema without matching migration | Present | Not represented in repo history | `employees`, `attendance`, `attendance_logs`, `financial_ledger`, `system_settings`, current `projects/phases/tasks` shape | High | Treat as baseline drift. Use `supabase db pull` or a manually reviewed baseline plan only after approval. | Future migrations can fail or overwrite assumptions if baseline is not documented. |

## 4. Live Schema Evidence

| Resource | Exists | Rows | RLS | Key evidence |
|---|---:|---:|---:|---|
| `employees` | Yes | `5` | On | Internal PK `id`; no `employee_id`; no `auth_user_id`; raw unique `email`; unique `qr_token`. |
| `attendance` | Yes | `31` | On | `employee_id` FK references `employees(id)`; unique `(employee_id, work_date, shift_name)`. |
| `attendance_logs` | Yes | `3` | On | `employee_id` FK references `employees(id)`. |
| `payroll`, `payroll_runs`, `payroll_items` | No | N/A | N/A | Not present. |
| `finance` | No | N/A | N/A | Not present. |
| `financial_ledger` | Yes | `64` | On | PK `id`; `requested_by` is text, not a stable employee FK. |
| `system_settings` | Yes | `7` | On | PK `key`; broad `ALL` policies for `anon` and `authenticated`. |
| `projects` | Yes | `2` | On | PK `id`; columns are `project_name`, `drive_url`, `status`, `created_at`. |
| `phases` | Yes | `0` | On | PK `id`; FK `project_id -> projects(id)`; lacks repo migration colorway/stage columns. |
| `project_members` | No | N/A | N/A | Not present. |
| `tasks` | Yes | `2` | On | PK `id`; uses text assignment/project fields; no stable employee/project/phase FK. |

## 5. Employees Schema Current State

| Check | Result |
|---|---|
| Primary key | `employees_pkey` on `id` |
| `id` column | Present, `bigint`, not null |
| `employee_id` column | Absent |
| `auth_user_id` column | Absent |
| `email` column | Present, `text`, not null |
| Email uniqueness | Raw unique constraint/index `employees_email_key` |
| `qr_token` uniqueness | Unique constraint/index `employees_qr_token_key` |
| Current relationship key | `employees.id`; used by `attendance.employee_id` and `attendance_logs.employee_id` |
| Record count | `5` |
| Duplicate `lower(trim(email))` | None found |
| Missing email | `1` employee, internal id `6` |
| Auth users | `0` |
| Certain auth/email mappings | `0` |

`full_name` must remain display-only and must not be used as relationship
authority. `employees.employee_id` is the approved business code, but it does not
exist in the live schema yet; adding it needs a separate approved schema step.

## 6. Current RLS, Policy, and Grant Findings

All scoped live tables checked have RLS enabled. Most have broad table grants to
`anon` and `authenticated`, but no policies. With RLS enabled and no policies,
those roles are effectively denied row access through the Data API.

Exception:

| Table | Policy | Who can read | Who can write | Risk |
|---|---|---|---|---|
| `system_settings` | `Allow anon all`, `Allow authenticated all`; both `USING true`, `WITH CHECK true` | `anon`, `authenticated` | `anon`, `authenticated` | High. Public/authenticated callers can read and mutate configuration rows if table privileges are exposed. |

Workflow drift note: local migration `20260704153000` would create permissive
workflow policies for `projects`, `phases`, and `tasks`, but live has no such
policies. Do not assume local migration policy state is live state.

## 7. Auth Bootstrap Plan

No auth users exist yet. Bootstrap must happen before `employees.auth_user_id`
can be backfilled.

Preferred flow:

1. Decide the first Owner/Admin employee record by internal employee id.
2. Ensure that employee has a verified, unique, non-shared email.
3. Create the first account using Supabase invite/admin-created flow outside
   source code. Do not hard-code or commit passwords.
4. User completes invite/password setup through Supabase Auth.
5. Verify `auth.users.id` for that email using masked/hash-only reports.
6. Run mapping dry-run: exactly one normalized employee email equals exactly one
   normalized auth user email.
7. Only after approval, backfill `employees.auth_user_id` for the certain
   mapping.

Role bootstrap categories:

| Category | Current count | Plan |
|---|---:|---|
| Employee with valid unique email | `4` | Eligible for invite/account creation after owner approval of each internal id. |
| Employee missing email | `1` | Not eligible for email bootstrap until a real unique email is assigned. |
| Duplicate normalized employee email | `0` | No blocker currently found. Recheck before migration. |
| Duplicate auth email | `0` | No auth users yet. Recheck after bootstrap. |
| Shared/placeholder email | Not confirmed by current metadata | Must be manually reviewed before invite. |
| Planned account without employee | `0` observed | Hold for manual review; do not map without employee. |
| Employee not needing account | User decision required | Keep `auth_user_id` null. |

Role rollout:

- Owner: bootstrap first, with explicit internal employee id and verified email.
- Admin: invite after Owner path is proven.
- Staff: invite in batches after identity migration and own-row policy tests.
- Reviewer: invite only after task/project scope is stable enough.
- Payroll/Finance: invite only after explicit payroll/finance permissions are
  designed; do not rely on a vague role.

## 8. Identity Migration Sequence

No step below has been run.

| Step | Action | Gate |
|---|---|---|
| 1 | Resolve or accept migration drift. | User approves one drift strategy. |
| 2 | Bootstrap one Owner/Admin auth account. | Verified unique employee email; no hard-coded password. |
| 3 | Verify `auth.users.id` and matching employee record. | One-to-one normalized email mapping only. |
| 4 | Add nullable `employees.auth_user_id`. | Approved identity migration. |
| 5 | Backfill certain mappings only. | Explicit approved internal ids; no full-name mapping. |
| 6 | Add unique index on `auth_user_id where auth_user_id is not null`. | No duplicates/orphans. |
| 7 | Roll out own-row RLS first. | Own-row tests pass for unauthenticated/wrong user/correct user. |
| 8 | Roll out role/permission policies later. | Compatibility role and future permission model approved. |

## 9. Drift Resolution Options

| Option | Description | When to use | Risk |
|---|---|---|---|
| A. Repair only first migration | Mark `20260704153000` applied only if every intended object/data/policy effect is proven equivalent or intentionally superseded. | Only after a detailed object-by-object equivalence review. | Current evidence does not prove equivalence; policies and column shapes differ. |
| B. Do not repair second migration | Keep `20260709110000` unapplied because live `phases` lacks its columns/index. | Current recommended state. | Future migration list remains divergent until reconciliation. |
| C. Pull live baseline | Use approved `supabase db pull`/review process to capture live schema as baseline, then write forward migrations from that baseline. | Best when live DB is source of truth and repo migrations are stale. | Needs careful review to avoid committing unwanted drift. |
| D. Reconcile manually | Write a future approved drift reconciliation migration that makes live schema match the intended repo/app schema. | Best when repo schema is intended source of truth. | Requires DDL approval and regression checks. |

Recommended for Batch 3C2: choose either live-baseline-first or
repo-schema-reconciliation. Do not repair migration history before that decision.

## 10. system_settings Remediation Plan

Current state:

- RLS enabled.
- Policy `Allow anon all`: `ALL`, role `anon`, `USING true`, `WITH CHECK true`.
- Policy `Allow authenticated all`: `ALL`, role `authenticated`, `USING true`,
  `WITH CHECK true`.
- Table grants include read/write privileges for `anon` and `authenticated`.

Risk:

- Anonymous callers can read configuration rows.
- Anonymous callers can insert/update/delete configuration rows where exposed.
- Authenticated non-admin users have the same broad access.
- Workflow/settings tampering can affect operational behavior.

Target:

- Remove anonymous write access entirely.
- Prefer no anonymous read unless a specific setting is explicitly public.
- Authenticated read should be scoped to explicitly public/non-sensitive keys only.
- Writes should be server-mediated or restricted to Owner/Admin after identity
  mapping exists.
- Settings used by public UI should be moved to an allowlisted read path, not
  broad `system_settings` access.

Rollout draft:

1. Inventory current app reads/writes of `system_settings`.
2. Classify keys into public read, authenticated read, admin-only, and server-only.
3. Add replacement policies or server route after identity exists.
4. Drop broad `Allow anon all` and `Allow authenticated all`.
5. Revoke unnecessary table privileges if compatible with API usage.
6. Test anonymous read/write, staff read/write, admin read/write, and app workflow
   loading.

Rollback plan:

- Restore prior policies only as an emergency rollback:
  `Allow anon all` and `Allow authenticated all` with `USING true` and
  `WITH CHECK true`.
- Prefer a narrower emergency policy for read-only public workflow settings if
  the UI is blocked.

## 11. Commands That May Be Needed After Approval

Discovery/read-only:

```bash
npx supabase migration list --linked
npx supabase db query --linked "<read-only validation SQL>"
```

Repair draft, not approved and not run:

```bash
npx supabase migration repair --linked --status applied 20260704153000
```

Do not run the repair command unless equivalence for the first migration is
approved. Do not mark `20260709110000` applied while live `phases` lacks the
colorway/stage columns and index.

Potential baseline/reconciliation commands for later planning only:

```bash
npx supabase db pull <approved_baseline_name> --linked
npx supabase migration list --linked
```

## 12. Blocking Questions

1. Which live employee internal id is the first Owner/Admin bootstrap account?
2. Should live database be treated as the baseline source of truth, or should repo
   migrations be reconciled into live schema?
3. Is `employees.employee_id` still required as a new business-code column even
   though it does not exist live today?
4. Should `system_settings` remediation happen before identity migration as an
   emergency security fix, or after Owner/Admin auth bootstrap?
5. Which employees should not receive Auth accounts in the first rollout?
6. Are current workflow tables (`projects/phases/tasks`) production data to
   preserve exactly, or can they be reshaped in a future approved workflow
   migration?

## 13. Readiness

| Area | Status | Reason |
|---|---|---|
| Drift resolution readiness | Not Ready | Root cause is identified as out-of-band/ledger drift, but strategy is not selected. |
| Auth bootstrap readiness | Partially Ready | Plan is clear; needs first Owner/Admin internal id and verified email decision. |
| Identity migration readiness | Not Ready | Must wait for drift decision and at least one auth user bootstrap. |
| Initial RLS readiness | Not Ready | Own-row policies require `auth_user_id`; `system_settings` needs separate policy remediation. |

