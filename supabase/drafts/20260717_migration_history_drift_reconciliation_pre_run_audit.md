# Migration History Drift Reconciliation Pre-run Audit

Date: 2026-07-17
Mode: Production Architect pre-run audit

Guardrails followed:

- Did not run `supabase db push`.
- Did not run `supabase db pull`.
- Did not run `supabase migration repair`.
- Did not run `supabase db reset`.
- Did not run SQL mutation, DDL, DML, commit, or push.
- Remote checks were read-only: `supabase migration list` and catalog SELECT queries.

## 1. Local Migration History

Local `supabase/migrations` files:

| Version | File |
| --- | --- |
| 20260704153000 | `20260704153000_move_workflow_to_project_tables.sql` |
| 20260709110000 | `20260709110000_add_colorway_stage_fields.sql` |
| 20260712181332 | `20260712181332_add_employee_auth_user_id.sql` |
| 20260713111027 | `20260713111027_rls_admin_financial_ledger_select.sql` |
| 20260714032416 | `20260714032416_rls_admin_office_expenses_shareholders_select.sql` |
| 20260714045636 | `20260714045636_project_members_foundation.sql` |
| 20260714082140 | `20260714082140_access_permission_foundation.sql` |
| 20260715030000 | `20260715030000_rls_employee_admin_view_select.sql` |
| 20260715073600 | `20260715073600_attendance_recovery_rls.sql` |
| 20260716035555 | `20260716035555_project_rls_pre_run_review.sql` |

## 2. Remote Migration History

Remote Supabase migration tracking table contains:

| Version | Remote name |
| --- | --- |
| 20260712181332 | `add_employee_auth_user_id` |
| 20260714032416 | `rls_admin_office_expenses_shareholders_select` |
| 20260715073600 | `attendance_recovery_rls` |

`supabase migration list` shows these local-only versions:

- `20260704153000`
- `20260709110000`
- `20260713111027`
- `20260714045636`
- `20260714082140`
- `20260715030000`
- `20260716035555`

This audit gives exact object analysis for the three drift migrations named in the task. The four additional local-only versions are a separate gate: they must be classified before any blanket repair command is approved.

## 3. Live Object Ownership Map

### Objects from `20260704153000_move_workflow_to_project_tables.sql`

| Object | Live state | Ownership / drift |
| --- | --- | --- |
| `public.projects` | Live table exists, but columns are `id`, `project_name`, `drive_url`, `status`, `created_at`. | Same table name, different semantics from local migration, which expects/adds `name`, `project_deadline`, `drive_link`. |
| `public.phases` | Live table exists with `id`, nullable `project_id`, `name`, `order_index`, nullable `created_at`. FK `phases_project_id_fkey` exists and is validated. | Same table name, partial overlap. Local migration would add old `status text default 'TODO'`. Foundation draft wants different status semantics. |
| `public.tasks` | Live table exists with legacy columns `project_name`, `assigned_to`, `current_phase`, `estimation_date`, `issue_note`, `packer_assigned`, `created_at`. | Same table name, different model from local migration, which expects `phase_id`, `name`, `assignee`, `deadline`, `note`, `status`. |
| `phases_project_id_order_index_idx` | Not live. | Local-only source object. |
| `tasks_phase_id_idx` | Not live. | Local-only source object. |
| Policies `workflow projects public access`, `workflow phases public access`, `workflow tasks public access` | Not live. | Deprecated/broad local-only policy objects. Must not be recreated. |
| Grants to `anon`/`authenticated` on projects/phases/tasks | Live grants are broad on all three tables. | Existing live broad grants are orphaned from remote migration history; local migration would regrant broad DML. |
| `system_settings` workflow backfill inserts/updates | Not an object; local migration includes DML backfill. | Dangerous to rerun in production without explicit data review. |

### Objects from `20260714045636_project_members_foundation.sql`

| Object | Live state | Ownership / drift |
| --- | --- | --- |
| `public.project_members` | Live. Columns match expected set: `id`, `project_id`, `employee_id`, `role_code`, `status`, `granted_at`, `granted_by_employee_id`, `revoked_at`, `revoked_by_employee_id`, `created_at`, `updated_at`. | Created by manual/live rollout or equivalent, but absent from remote migration history. |
| Project member FKs | Live and validated: project, employee, granted_by, revoked_by. | Exact semantic match to local migration. |
| Project member checks | Live: role code, status, revocation state, grant/revoke order. | Exact semantic match to local migration. |
| Indexes | Live: `project_members_one_active_role`, `project_members_project_id_idx`, `project_members_employee_id_idx`, `project_members_status_idx`, `project_members_project_status_idx`. | Exact semantic match to local migration. |
| Function `public.set_project_members_audit_fields()` | Live, owner `postgres`, plpgsql, security invoker, search path `public, auth, pg_temp`. Body matches local migration semantics. | Exact match. |
| Trigger `set_project_members_audit_fields` | Live before insert/update on `project_members`. | Exact match. |
| RLS and policies | RLS live. Policies live: admin view select, admin manage insert, admin manage update. | Exact match. |
| Table grants | Live authenticated SELECT/INSERT/UPDATE only; no anon grants on `project_members`. | Exact match. |
| Function grants | `set_project_members_audit_fields` still has EXECUTE grant to `anon` and `authenticated`. | Difference from migration intent: migration did not revoke trigger function execute. This is not used as an RLS helper, but should be reviewed as hardening debt. |

### Objects from `20260716035555_project_rls_pre_run_review.sql`

| Object | Live state | Ownership / drift |
| --- | --- | --- |
| `public.is_project_member(bigint)` | Live, owner `postgres`, SQL stable, security definer, search path `public, auth, pg_temp`. | Exact match. |
| `public.has_project_role(bigint,text)` | Live, owner `postgres`, SQL stable, security definer, search path `public, auth, pg_temp`. | Exact match. |
| `public.can_view_project(bigint)` | Live, owner `postgres`, SQL stable, security definer, search path `public, auth, pg_temp`. | Exact match. |
| Grants on project RLS helpers | Live EXECUTE to `authenticated`; no `anon` grant found. | Exact match. |
| `projects project access select` policy | Live SELECT to authenticated using `can_view_project(id)`. | Exact match. |
| RLS on `public.projects` | Enabled live. | Exact match. |

### Phase Workflow Foundation Draft Ownership

The draft `supabase/drafts/20260716_phase_workflow_foundation_pre_run_forward.sql` owns the new phase workflow authority, but is not applied live:

- New phase columns not live: `description`, `status`, `assignee_employee_id`, `deadline`, `started_at`, `completed_at`, `updated_at`, `updated_by_employee_id`.
- New phase constraints not live: `phases_status_check`, `phases_assignee_employee_id_fkey`, `phases_updated_by_employee_id_fkey`, `phases_completed_at_status_check`, `phases_started_completed_order_check`.
- New phase indexes not live: `phases_project_order_unique`, `phases_project_status_order_idx`, `phases_assignee_employee_id_idx`, `phases_deadline_idx`, `phases_updated_at_idx`.
- New phase helper/trigger not live: `set_phase_workflow_audit_fields`, `phases_set_workflow_audit_fields`.
- New phase policy not live: `phases project access select`.

## 4. Exact Drift Report

| Migration | Local file | Remote history | Objects live | Exact match | Conflict risk | Proposed action |
| --- | --- | --- | --- | --- | --- | --- |
| `20260704153000` | Present | Absent | Tables `projects`, `phases`, `tasks` exist but are semantically different; old broad policies not live; backfill source may still exist. | No. | Very high. Re-run can mutate projects/phases/tasks, add deprecated columns, regrant broad anon/authenticated DML, create broad RLS policies, and conflict with foundation status semantics. | BLOCKED / SUPERSEDED. Do not run. Replace with explicit reconciliation/validation record after live schema is approved. |
| `20260714045636` | Present | Absent | `project_members`, constraints, indexes, trigger, RLS policies, grants exist live. | Yes for core table/schema/RLS. Minor hardening note: trigger function has public-derived execute grants to anon/authenticated. | Medium if run as-is: `create table if not exists` avoids table creation error, but named constraints inside `create table` are skipped because table exists; policies are dropped/recreated; function is replaced; grants are reissued. No data backfill. | APPLIED via repair only after approval and validation. Do not rerun. |
| `20260716035555` | Present | Absent | Project helper functions and `projects project access select` policy exist live. | Yes. | Medium if run as-is: functions are replaced and policy is dropped/recreated. No DML, but transient policy drop/recreate is a production auth event. | APPLIED via repair only after approval and validation. Do not rerun. |

## 5. Conflict Report

### `20260704153000_move_workflow_to_project_tables.sql`

1. Re-run object-exists errors:
   - `create table if not exists` avoids table-exists errors for `projects`, `phases`, `tasks`.
   - `alter table add column if not exists` avoids column-exists errors.
   - Constraint blocks check by name before adding; likely avoids hard object-exists errors.
2. Dangerous ALTER/DML:
   - Adds `projects.name`, `projects.project_deadline`, `projects.drive_link`.
   - Adds `phases.status text not null default 'TODO'`.
   - Adds task columns `deadline`, `note`, `status`, `name`, `assignee_id`, `assignee_name`.
   - Runs DML updates against `projects`, `phases`, and `tasks` from legacy columns.
   - Inserts projects/phases/tasks from `system_settings` where `group_name = 'PRODUCTION_WORKFLOW'`.
3. Policy duplicate names:
   - Current live policies do not include `workflow projects public access`, `workflow phases public access`, or `workflow tasks public access`.
   - Re-run would create these broad ALL policies after `drop policy if exists`, not fail.
4. Function same-name conflict:
   - No workflow-related functions in this migration.
5. Backfill/update live data:
   - Yes. Multiple `update public.projects`, `update public.phases`, `update public.tasks`.
   - Yes. Inserts into `projects`, `phases`, `tasks` from `system_settings`.
6. Deprecated/superseded objects:
   - `phases.status` with old default `'TODO'`.
   - Broad public workflow policies.
   - Project/task name-based workflow migration from `system_settings`.
7. Absolute re-run rule:
   - Must not be rerun in production.

### `20260714045636_project_members_foundation.sql`

1. Re-run object-exists errors:
   - `create table if not exists public.project_members` skips table definition because table exists.
   - `create index if not exists` skips existing indexes.
   - `create or replace function` replaces body.
   - `drop trigger if exists` then `create trigger` avoids duplicate trigger error.
   - Policies are dropped/recreated.
2. Dangerous ALTER/DML:
   - No data backfill or DML.
   - Grants/revokes and RLS/policy changes would be production auth mutations.
3. Policy duplicate names:
   - Live names match local migration and would be dropped/recreated:
     - `project members admin view select`
     - `project members admin manage insert`
     - `project members admin manage update`
4. Function same-name/body:
   - `set_project_members_audit_fields()` live body matches local semantics.
5. Backfill/update live data:
   - None.
6. Deprecated/superseded objects:
   - None for core membership model.
   - Function execute grants to anon/authenticated should be reviewed, but are not a blocker for marking migration applied if accepted.
7. Absolute re-run rule:
   - Should not be rerun because it would replace trigger/policies/grants on live auth-critical table.

### `20260716035555_project_rls_pre_run_review.sql`

1. Re-run object-exists errors:
   - `create or replace function` avoids function duplicate errors.
   - `drop policy if exists` then `create policy` avoids duplicate policy errors.
2. Dangerous ALTER/DML:
   - No DML.
   - Re-run drops and recreates live project SELECT policy; that is an authorization mutation and should not be used for history reconciliation.
3. Policy duplicate names:
   - Live policy `projects project access select` exists and matches.
4. Function same-name/body:
   - `is_project_member(bigint)`, `has_project_role(bigint,text)`, and `can_view_project(bigint)` live bodies match local migration semantics.
5. Backfill/update live data:
   - None.
6. Deprecated/superseded objects:
   - None.
7. Absolute re-run rule:
   - Should not be rerun for reconciliation; use approved repair/classification after validation.

## 6. Reconciliation Options

### Option A: Supabase migration repair to mark applied

- Pros: Aligns history without re-running already-live schema/auth objects; preserves original migration filenames.
- Risks: Dangerous if used broadly because additional local-only migrations exist and not all are audited here.
- Auditability: Good if paired with this report and validation output.
- Production safety: Good for `20260714045636` and `20260716035555` after approval; not safe for `20260704153000`.
- Team impact: Low if documented and shared.
- Rollback impact: Repair history changes are metadata-only but need deliberate reverse repair if classification is wrong.

### Option B: Create a new baseline/reconciliation migration

- Pros: Can encode source-of-truth comments and validation hardening in a normal migration path.
- Risks: Any actual DDL/RLS in the baseline can mutate production and must be reviewed like a real migration.
- Auditability: Strong if it records object state and supersession explicitly.
- Production safety: Medium; safe only if validation-only or metadata comments are approved.
- Team impact: Medium because future contributors must understand baseline vs older files.
- Rollback impact: Depends on whether it mutates objects; validation-only/comment-only rollback is simple, DDL rollback is not.

### Option C: Keep old migrations superseded and create validation-only record/process

- Pros: Highest production safety for `20260704153000`; avoids running deprecated DML/broad policies.
- Risks: Requires disciplined docs/process because Supabase history still needs repair or future `db push` remains blocked.
- Auditability: Strong when report, validation SQL, and classification are committed.
- Production safety: Highest for old workflow migration.
- Team impact: Medium; developers must not delete or rerun superseded migration.
- Rollback impact: Minimal because no production object changes.

### Option D: Edit local unrun migration if safe and not shared

- Pros: Can prevent future accidental bad rollout.
- Risks: These files are already in repo history/workflow and may be shared; editing migration history can break team reproducibility.
- Auditability: Weak unless replacement and reason are very explicit.
- Production safety: Unsafe for `20260704153000`; unnecessary for the two already-live migrations.
- Team impact: High; changes migration checksums/source history.
- Rollback impact: Confusing unless version-control and deployment history are tightly controlled.

Recommended option: combine Option A for exact-live migrations (`20260714045636`, `20260716035555`) after approval with Option C for `20260704153000`. Do not include additional local-only migrations in a repair command until they have their own exact audit.

## 7. Recommended Classification

| Migration | Classification | Reason |
| --- | --- | --- |
| `20260704153000_move_workflow_to_project_tables.sql` | SUPERSEDED + BLOCKED | Contains deprecated system_settings workflow migration, broad anon/authenticated policies, old status semantics, and DML/backfill. Must not run. |
| `20260714045636_project_members_foundation.sql` | APPLIED / MANUAL REVIEW | Live core objects match. Needs explicit approval for metadata repair and optional review of trigger function EXECUTE grants. |
| `20260716035555_project_rls_pre_run_review.sql` | APPLIED / MANUAL REVIEW | Live helpers and project SELECT policy match. Needs explicit approval for metadata repair. |
| Phase Workflow Foundation draft | MANUAL REVIEW / PENDING | Draft is the new authority for phase workflow but must wait until drift is reconciled. |

Additional local-only versions discovered by `migration list`:

| Migration | Classification |
| --- | --- |
| `20260709110000_add_colorway_stage_fields.sql` | NOT_APPLIED after Part 2 audit |
| `20260713111027_rls_admin_financial_ledger_select.sql` | APPLIED after Part 2 audit |
| `20260714082140_access_permission_foundation.sql` | APPLIED_WITH_DRIFT after Part 2 audit |
| `20260715030000_rls_employee_admin_view_select.sql` | APPLIED after Part 2 audit |

## 8. Phase Workflow Overlap Report

| Area | `20260704153000` old migration | Phase Workflow Foundation draft | Decision |
| --- | --- | --- | --- |
| `phases.status` | Adds `text not null default 'TODO'`; backfills from `phase_status`; inserted values include `DOING`/`TODO`. | Adds `text not null default 'NOT_STARTED'`; allowed values `NOT_STARTED`, `IN_PROGRESS`, `BLOCKED`, `REVIEW`, `COMPLETED`, `SKIPPED`, `CANCELLED`. | Foundation is authority. Old status semantics must be superseded, not merged. |
| `phases.description` | No phase description column. | Adds `description text`. | Keep foundation. |
| `phases.deadline` | No phase deadline; task deadline is `text`. | Adds `deadline date` on phases. | Keep foundation date-level phase deadline. |
| `phases.assignee_employee_id` | No stable employee assignment on phases. | Adds FK to `employees(id)`. | Keep foundation stable employee assignment. |
| `phases.updated_at` | No phase update audit field. | Adds `updated_at timestamptz not null default now()`. | Keep foundation. |
| Policies | Creates broad ALL policies to anon/authenticated on projects/phases/tasks. | Creates SELECT-only `phases project access select` to authenticated using `can_view_project(project_id)`. | Keep foundation policy; old policies blocked. |
| Backfill | Copies from `system_settings` into projects/phases/tasks and updates legacy columns. | No task mutation; only phase schema/RLS foundation. | Do not run old backfill. Any backfill must be separately reviewed. |
| Status semantics | Legacy task-like `TODO`/`DOING` vocabulary. | Controlled phase workflow vocabulary. | Foundation is new authority. |

## 9. Validation Plan

Read-only validation should prove:

1. `project_members` schema, constraints, indexes, RLS, policies, trigger, function body, owner, and grants match approved foundation.
2. Project helper functions `is_project_member`, `has_project_role`, `can_view_project` match approved bodies and are executable only by `authenticated`.
3. Project SELECT policy is exactly `projects project access select` to authenticated using `can_view_project(id)`.
4. Phase legacy objects currently live are only base table/FK/RLS/grants; Phase Workflow Foundation objects are absent before rollout.
5. `20260704153000` is not needed and must not be rerun because live tables already exist and new authority supersedes it.
6. Foundation draft touches only `public.phases`, phase helper/trigger, phase SELECT policy, phase grants, and phase comments.
7. Additional local-only migration versions are classified before any repair command is executed.

Draft SQL: `supabase/drafts/20260717_migration_history_drift_reconciliation_validation.sql`.

## 10. Safe Repair Plan

Pre-approved sequence:

1. Backup/export metadata: migration list, migration tracking table rows, relevant catalog objects, policy/function/trigger/grant definitions.
2. Validate live object state with read-only validation SQL.
3. Approve classification for every local-only migration, including the four additional local-only versions.
4. If approved, repair migration history only for versions classified APPLIED. Do not repair `20260704153000` as applied unless the team intentionally accepts the deprecated migration as logically applied/superseded.
5. Re-run `supabase migration list`.
6. Verify no pending historical migration would run dangerous DML/RLS.
7. Review Phase Workflow Foundation migration against reconciled history.
8. Roll out foundation only after explicit approval.
9. Validate foundation.
10. Deploy application phase workflow.

Expected commands, not run:

```powershell
npx.cmd supabase migration list
npx.cmd supabase db query --linked --file supabase/drafts/20260717_migration_history_drift_reconciliation_validation.sql

# Only after explicit approval and only for approved APPLIED versions:
npx.cmd supabase migration repair --status applied 20260714045636
npx.cmd supabase migration repair --status applied 20260716035555

# Do not run unless separately approved after additional audit:
# npx.cmd supabase migration repair --status applied <other_local_only_version>
```

## 11. Gates

| Gate | Status | Reason |
| --- | --- | --- |
| No mutation run | PASS | Only read-only CLI/catalog checks and local draft file creation. |
| Local history inventoried | PASS | All local migration files listed. |
| Remote history inventoried | PASS | Remote tracking rows listed. |
| Named drift migrations audited | PASS | Exact object-level audit completed for three requested migrations. |
| Additional local-only drift classified | PASS after Part 2 | Four extra local-only migrations were exact-audited and classified below. |
| `20260704153000` safe to run | BLOCKED | Contains DML/backfill, deprecated status semantics, broad policies/grants. |
| `20260714045636` safe to repair | PASS after approval | Live objects match core migration; repair is metadata-only but requires approval. |
| `20260716035555` safe to repair | PASS after approval | Live helpers/policy match; repair is metadata-only but requires approval. |
| Phase Workflow Foundation rollout | BLOCKED | Must wait for migration drift reconciliation approval and full pending-history review. |

## 12. Safe Next Action

Do not run foundation and do not repair yet.

Next safe action is reviewer approval of this classification plus the Part 2 classifications below. Do not run repair until the exact approved candidate list is confirmed.

---

# Part 2: Additional Local-only Migration Audit

Date: 2026-07-17

Guardrails followed:

- Did not run `supabase migration repair`.
- Did not run `supabase db push`, `supabase db pull`, or `supabase db reset`.
- Did not run SQL mutation, DDL, DML, commit, or push.
- Remote/live checks were read-only catalog and count SELECT queries.

## A. Exact File Resolution

Each requested timestamp maps to exactly one local migration file.

| Timestamp | Local filename | Purpose | Tables/functions/policies affected |
| --- | --- | --- | --- |
| `20260709110000` | `20260709110000_add_colorway_stage_fields.sql` | Add lightweight colorway/stage runtime fields to `public.phases`. | `public.phases` columns and `phases_project_colorway_order_idx`. |
| `20260713111027` | `20260713111027_rls_admin_financial_ledger_select.sql` | Add admin/owner read helper and financial ledger SELECT policy. | `public.is_app_admin()`, `public.financial_ledger`, policy `financial ledger admin select`, function grants. |
| `20260714082140` | `20260714082140_access_permission_foundation.sql` | Create workspace/permission foundation tables, helpers, RLS, policies, and seed permission catalog. | `employee_workspace_access`, `permissions`, `employee_permissions`, helper functions, triggers, policies, grants. |
| `20260715030000` | `20260715030000_rls_employee_admin_view_select.sql` | Add admin workspace employee-list SELECT bridge. | `public.employees`, policy `employees admin employee view select`; depends on access permission helpers. |

## B. Local Migration Content Audit

| Migration | Object | Operation | DDL/DML | Idempotent | Destructive risk | Dependency |
| --- | --- | --- | --- | --- | --- | --- |
| `20260709110000` | `public.phases.colorway_name` | `add column if not exists text` | DDL | Yes | Low by itself; changes app-visible schema. | `public.phases` exists. |
| `20260709110000` | `public.phases.colorway_code` | `add column if not exists text` | DDL | Yes | Low. | `public.phases` exists. |
| `20260709110000` | `public.phases.stage_type` | `add column if not exists text` | DDL | Yes | Low. | `public.phases` exists. |
| `20260709110000` | `public.phases.stage_owner` | `add column if not exists text` | DDL | Yes | Medium semantic risk; text owner conflicts with stable employee-id direction. | `public.phases` exists. |
| `20260709110000` | planned/actual date columns | Four `text` date columns | DDL | Yes | Medium semantic risk; date stored as text. | `public.phases` exists. |
| `20260709110000` | `public.phases.progress` | `integer not null default 0` | DDL | Yes | Medium; adds non-null default to existing rows. | `public.phases` exists. |
| `20260709110000` | `public.phases.next_action` | `text` | DDL | Yes | Low. | `public.phases` exists. |
| `20260709110000` | `public.phases.required_review` | `boolean not null default false` | DDL | Yes | Medium; adds non-null default to existing rows. | `public.phases` exists. |
| `20260709110000` | `phases_project_colorway_order_idx` | Create index on `(project_id, colorway_name, order_index)` | DDL | Yes | Low. | Added columns exist. |
| `20260709110000` | PostgREST schema cache | `notify pgrst, 'reload schema'` | DDL-ish notification | Repeatable | Low. | PostgREST listener optional. |
| `20260713111027` | Preconditions | Require `financial_ledger` exists, RLS enabled, policy absent. | Read/guard | No if policy exists | Rerun hard-fails once live policy exists. | `financial_ledger` with RLS. |
| `20260713111027` | `public.is_app_admin()` | `create or replace`, stable, security definer, fixed search path. | DDL | Replaces body | Medium if body changed; auth helper. | `employees.auth_user_id`, `employees.status`, `employees.role`. |
| `20260713111027` | Function ownership/comment/grants | Owner postgres, revoke public/anon/authenticated, grant authenticated. | DDL | Repeatable | Low/medium auth surface. | Function exists. |
| `20260713111027` | `financial ledger admin select` | Create SELECT policy to authenticated using `public.is_app_admin()`. | DDL/RLS | No; precondition blocks duplicate. | Low if exact, high if body wrong. | Helper exists; financial ledger RLS. |
| `20260714082140` | `employee_workspace_access` | Create table with FK/check constraints. | DDL | Table creation skipped if table exists. | Medium; auth foundation. | `public.employees`. |
| `20260714082140` | Workspace indexes | Unique active and lookup indexes. | DDL | Yes | Low. | Table exists. |
| `20260714082140` | `permissions` | Create catalog table. | DDL | Table creation skipped if exists. | Low. | None. |
| `20260714082140` | Permission catalog | Insert 17 permission rows `on conflict do nothing`. | DML seed | Yes for duplicate codes | Low duplicate risk; does not update descriptions. | `permissions` table. |
| `20260714082140` | `employee_permissions` | Create table with FKs/check constraints. | DDL | Table creation skipped if exists. | Medium; auth foundation. | `employees`, `permissions`. |
| `20260714082140` | Permission indexes | Unique active effect and lookup indexes. | DDL | Yes | Low. | Table exists. |
| `20260714082140` | `set_access_permissions_updated_at()` | Create/replace trigger function. | DDL | Replaces body | Low. | None. |
| `20260714082140` | Access triggers | Drop/create update triggers on two foundation tables. | DDL | Yes | Medium transient trigger mutation if rerun. | Function and tables exist. |
| `20260714082140` | Auth helpers | Create/replace `current_employee_id`, `has_workspace_access`, `has_permission`, `can_access_admin`, `can_access_staff`; security definer fixed search path. | DDL | Replaces bodies | High if changed; central RLS helpers. | `employees`, foundation tables. |
| `20260714082140` | Function grants | Revoke all from public/anon/authenticated; grant execute to authenticated. | DDL | Repeatable | Low/medium. | Functions exist. |
| `20260714082140` | Table grants | Revoke all from public/anon/authenticated; grant SELECT to authenticated. | DDL | Repeatable | Medium; auth surface. | Foundation tables. |
| `20260714082140` | RLS | Enable RLS on three foundation tables. | DDL/RLS | Repeatable | Low. | Tables exist. |
| `20260714082140` | Policies | Drop/create three SELECT policies. | DDL/RLS | Yes | Medium transient policy mutation if rerun. | Helpers and tables exist. |
| `20260715030000` | Preconditions | Require employees, helpers, employees RLS, policy absent. | Read/guard | No if policy exists | Rerun hard-fails once live policy exists. | Access foundation helpers. |
| `20260715030000` | `employees admin employee view select` | Create SELECT policy to authenticated with ADMIN_WORKSPACE + EMPLOYEE_VIEW. | DDL/RLS | No; precondition blocks duplicate. | Low if exact. | `has_workspace_access`, `has_permission`. |

## C. Remote History Status

Remote `supabase_migrations.schema_migrations` contains only:

- `20260712181332` / `add_employee_auth_user_id`
- `20260714032416` / `rls_admin_office_expenses_shareholders_select`
- `20260715073600` / `attendance_recovery_rls`

| Timestamp | Remote record | Remote filename/name | Status | Manual-run signal |
| --- | --- | --- | --- | --- |
| `20260709110000` | Absent | None | Local-only, not recorded. | No live target columns/index found; likely not applied. |
| `20260713111027` | Absent | None | Local-only, not recorded. | Live function/policy exactly match; later recorded migration `20260714032416` depends on `is_app_admin()`. |
| `20260714082140` | Absent | None | Local-only, not recorded. | Live tables/functions/policies/seed catalog match core migration. |
| `20260715030000` | Absent | None | Local-only, not recorded. | Live employees admin SELECT policy exactly matches. |

## D. Live Object Comparison

| Migration | Object | Local definition | Live definition | Match | Difference | Risk if rerun |
| --- | --- | --- | --- | --- | --- | --- |
| `20260709110000` | 11 phase columns | Adds `colorway_name`, `colorway_code`, `stage_type`, `stage_owner`, planned/actual date text columns, `progress`, `next_action`, `required_review`. | None of these columns exist on live `public.phases`. | No | Object missing. | Would mutate live schema; do not repair as applied. |
| `20260709110000` | `phases_project_colorway_order_idx` | Index on `phases(project_id, colorway_name, order_index)`. | Missing. | No | Object missing. | Would require columns first; do not repair as applied. |
| `20260713111027` | `public.is_app_admin()` | SQL stable security definer; search path `public, auth, pg_temp`; checks `auth.uid()` maps to active employee role `ADMIN`/`OWNER`. | Same signature, return type, owner `postgres`, volatility stable, security definer, body semantics, search path. | Yes | None found. | Rerun would replace auth helper and then fail/stop if policy precondition catches duplicate. Not needed. |
| `20260713111027` | Function grants | Revoke public/anon/authenticated; grant execute to authenticated. | EXECUTE only to authenticated for `is_app_admin()`. | Yes | None found. | Rerun mutates function ACL. |
| `20260713111027` | `financial ledger admin select` | SELECT to authenticated using `public.is_app_admin()`. | SELECT to authenticated using `is_app_admin()`. | Yes | Schema-qualified display differs only by catalog normalization. | Rerun precondition raises because policy exists. |
| `20260714082140` | `employee_workspace_access` | Table with 9 columns, FKs/checks, RLS. | Columns/constraints/RLS match. | Yes | Data rows now exist. | Rerun skips table definition but mutates grants/policies/triggers/functions. |
| `20260714082140` | `permissions` | Table with `code`, `description`, `created_at`; pkey code. | Columns/constraint/RLS match. | Yes | None for schema. | Seed insert is idempotent. |
| `20260714082140` | `employee_permissions` | Table with 10 columns, FKs/checks, RLS. | Columns/constraints/RLS match. | Yes | Data rows now exist. | Rerun skips table definition but mutates grants/policies/triggers/functions. |
| `20260714082140` | Indexes | Six named foundation indexes plus PKs. | All named indexes exist and match. | Yes | None found. | Low if rerun, but unnecessary. |
| `20260714082140` | Triggers | Two before-update triggers using `set_access_permissions_updated_at()`. | Both live and enabled. | Yes | None found. | Rerun drops/recreates triggers. |
| `20260714082140` | Helpers | Five security-definer SQL helpers plus one trigger function. | Signatures, return types, owners, volatility, security mode, search paths, and body semantics match. | Yes | Trigger function still has EXECUTE grants to anon/authenticated from default PUBLIC-like behavior after creation. | Rerun mutates auth helper bodies/ACL. |
| `20260714082140` | Policies | Three SELECT policies: permissions authenticated, workspace own, employee permissions own. | All three live with matching roles/cmd/predicates. | Yes | None found. | Rerun drops/recreates policies. |
| `20260715030000` | `employees admin employee view select` | SELECT to authenticated using ADMIN_WORKSPACE + EMPLOYEE_VIEW. | Live exact policy exists. | Yes | None found. | Rerun precondition raises because policy exists. |

## E. DML / Backfill Forensics

| Migration | DML/backfill | Expected effect | Live evidence | Re-run safety |
| --- | --- | --- | --- | --- |
| `20260709110000` | None. | No row changes; non-null defaults would populate metadata for existing rows at schema level. | Phase columns absent; no effect occurred. | Not safe to repair; running is a schema decision, not reconciliation. |
| `20260713111027` | None. | No data changes. | `financial_ledger` row count read as 64 only for no-mutation context; policy/helper live. | Do not rerun; repair candidate after approval. |
| `20260714082140` | Seed `public.permissions` with 17 rows using `on conflict do nothing`. | Permission catalog contains 17 stable codes. No employee access/permission backfill in migration. | `permissions` has exactly 17 expected codes. `employee_workspace_access` has 2 rows and `employee_permissions` has 17 rows, which indicates post-foundation manual/operational backfill after this migration's scope. | Seed is duplicate-safe, but rerun would mutate policies/functions/triggers. Classification is applied with post-migration data drift. |
| `20260715030000` | None. | No data changes. | Employees policy live; employees row count read as 5 only for no-mutation context. | Do not rerun; repair candidate after approval. |

## F. Policy / RLS Audit

| Migration | Policy/RLS object | Local semantics | Live semantics | Risk |
| --- | --- | --- | --- | --- |
| `20260709110000` | None. | No RLS/policy changes. | No matching policy expected. | None for RLS; schema still not applied. |
| `20260713111027` | `financial ledger admin select` | SELECT, authenticated, `public.is_app_admin()`. | SELECT, authenticated, `is_app_admin()`. | Exact match; no broad anon policy or ALL policy introduced. |
| `20260713111027` | `is_app_admin()` | Security definer, fixed search path, no client-provided user id. | Matches; EXECUTE only authenticated. | Acceptable RLS recursion avoidance helper. |
| `20260714082140` | Foundation RLS | RLS enabled on three new tables. | Enabled. | Exact match. |
| `20260714082140` | Foundation policies | SELECT-only to authenticated; permissions catalog `true`; access/permission rows own-employee only. | Matches. | No ALL policy, no anon table access found. |
| `20260714082140` | Access helpers | Security definer, fixed search path. | Matches; EXECUTE only authenticated for SQL helpers. | Trigger function execute grant to anon/authenticated should be reviewed as hardening debt, but it is security invoker and not an RLS helper. |
| `20260715030000` | `employees admin employee view select` | SELECT-only to authenticated; ADMIN_WORKSPACE + EMPLOYEE_VIEW. | Matches. Existing own-profile policy also remains. | Exact match; no INSERT/UPDATE/DELETE/ALL policy introduced. |

## G. Function Body Comparison

| Function | Local signature/mode | Live signature/mode | Body comparison | Grants |
| --- | --- | --- | --- | --- |
| `is_app_admin()` | `() returns boolean`, SQL stable security definer, search path `public, auth, pg_temp`. | Same, owner `postgres`. | Exact semantics: non-null `auth.uid()`, active employee, role in `ADMIN`/`OWNER`. | EXECUTE to authenticated only. |
| `set_access_permissions_updated_at()` | `() returns trigger`, plpgsql security invoker, search path `public, pg_temp`. | Same, owner `postgres`. | Exact semantics: set `new.updated_at = now()`. | EXECUTE visible to anon/authenticated; review hardening debt. |
| `current_employee_id()` | `() returns bigint`, SQL stable security definer. | Same, owner `postgres`. | Exact semantics: `employees.auth_user_id = auth.uid()`, active status and `is_active`. | EXECUTE to authenticated only. |
| `has_workspace_access(text)` | `(workspace_code text) returns boolean`, SQL stable security definer. | Same. | Exact semantics: whitelisted workspace, current employee, active unrevoked access. | EXECUTE to authenticated only. |
| `has_permission(text)` | `(permission_code text) returns boolean`, SQL stable security definer. | Same. | Exact semantics: known permission, no active DENY, active ALLOW required. | EXECUTE to authenticated only. |
| `can_access_admin()` | `() returns boolean`, SQL stable security definer. | Same. | Exact semantics: delegates to ADMIN_WORKSPACE. | EXECUTE to authenticated only. |
| `can_access_staff()` | `() returns boolean`, SQL stable security definer. | Same. | Exact semantics: delegates to STAFF_WORKSPACE. | EXECUTE to authenticated only. |

## H. Classification

| Migration | Classification | Evidence | Repair candidate | Required action |
| --- | --- | --- | --- | --- |
| `20260709110000_add_colorway_stage_fields.sql` | NOT_APPLIED | Remote absent; live `phases` lacks all 11 columns and target index. | No | Do not repair. Manual architecture review: either replace/supersede with Phase Workflow Foundation-compatible schema or run only after explicit approval. |
| `20260713111027_rls_admin_financial_ledger_select.sql` | APPLIED | Remote absent; live helper function, grants, and financial ledger policy match. No DML. | Yes, after approval | Repair as applied candidate with validation query. Do not rerun because policy precondition now fails. |
| `20260714082140_access_permission_foundation.sql` | APPLIED_WITH_DRIFT | Remote absent; all core tables, constraints, indexes, RLS, policies, helpers, triggers, grants, and 17 permission seed rows match. Data rows now exist in access override tables after the migration's no-backfill scope. | Yes, after manual approval | Repair as applied candidate only if team accepts post-migration data drift as operational/backfill state. Add hardening review for trigger function EXECUTE grants. |
| `20260715030000_rls_employee_admin_view_select.sql` | APPLIED | Remote absent; live employees SELECT policy matches. No DML. | Yes, after approval | Repair as applied candidate with validation query. Do not rerun because policy precondition now fails. |

## I. Repair Safety Evidence

| Migration | Core objects exist | Semantics match | DML effect resolved | Rerun dangerous/unneeded | Repair hides missing object? | Validation query |
| --- | --- | --- | --- | --- | --- | --- |
| `20260709110000` | No | No | No DML | Running would mutate schema | Yes, repair would hide missing columns/index | Included as NOT_APPLIED check only. |
| `20260713111027` | Yes | Yes | No DML | Yes; duplicate policy precondition fails and helper/ACL mutation unneeded | No | Add to validation draft. |
| `20260714082140` | Yes | Yes | Permission seed present; later access data exists | Yes; rerun mutates auth helpers/policies/triggers | No, if data drift accepted | Add to validation draft. |
| `20260715030000` | Yes | Yes | No DML | Yes; duplicate policy precondition fails | No | Add to validation draft. |

## J. Superseded / Not-applied Handling

`20260709110000_add_colorway_stage_fields.sql` should not be repaired as applied. It is not live. Before any rollout, decide whether it is:

- superseded by Phase Workflow Foundation and future colorway/stage schema, or
- still needed as a separately approved compatibility migration.

If superseded, do not delete the file. Add a warning header in a separate approved guidance/migration-maintenance change:

```sql
-- SUPERSEDED / DO NOT RUN WITHOUT ARCHITECT APPROVAL.
-- Replaced by: <approved Phase Workflow / Colorway Stage migration>.
-- Reason: live schema never received these phase colorway columns, and newer
-- Phase Workflow Foundation owns phase workflow semantics.
```

## L. Part 2 Gates

| Gate | Status | Reason |
| --- | --- | --- |
| Resolve exact file for all four timestamps | PASS | Each timestamp has exactly one local file. |
| Audit DDL/DML in each file | PASS | All creates/alters/indexes/functions/triggers/RLS/policies/grants/DML reviewed. |
| Remote history read | PASS | `schema_migrations` read; four timestamps absent. |
| Live object comparison complete | PASS | Relevant columns, constraints, indexes, RLS, policies, triggers, functions, grants, and seed rows checked. |
| Function/policy semantics compared | PASS | Signatures, modes, search paths, bodies, roles, predicates, and grants compared. |
| Backfill/data effect assessed | PASS | Permission seed present; access override data drift explicitly noted. |
| Each migration classified | PASS | NOT_APPLIED, APPLIED, APPLIED_WITH_DRIFT, APPLIED assigned. |
| No repair run | PASS | No repair command executed. |
| No live mutation | PASS | Only read-only SELECT/catalog checks. |
| Exact next action | PASS | Approve repair candidates separately; decide 20260709110000 fate before foundation rollout. |

## M. Part 2 Safe Next Action

Do not run `20260709110000` and do not repair it.

After review approval, the repair candidates are:

```powershell
npx.cmd supabase migration repair --status applied 20260713111027
npx.cmd supabase migration repair --status applied 20260714082140
npx.cmd supabase migration repair --status applied 20260715030000
```

These commands were not run. Before running them, execute the updated read-only validation draft and capture output for the approval record.
