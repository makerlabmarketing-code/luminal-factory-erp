# Production Runtime Gate Operator Runbook

**Prepared:** 2026-07-28
**Boundary:** commands below are operator instructions. They were not executed while preparing this runbook. Never enable a flag before its package and smoke tests pass. Disable the flag before any rollback.

## 1. Choose exactly one delivery workflow

### A. Supabase GitHub Integration (canonical)

Use this for an approved forward file promoted under `supabase/migrations/`. Do not run `supabase db push`, migration repair, or direct SQL. The operator:

```bash
git checkout main
git pull --ff-only
git status --short --branch
cat supabase/.temp/project-ref
supabase projects list
```

Confirm the checked-out commit is approved, the working tree is clean, and the linked project reference is production. Run the package's **pre-run validation read-only** through the production SQL editor and retain the output. After review approval, merge the protected-main PR; the GitHub Integration applies only the tracked forward migration. Confirm the integration job succeeded, then run the **post-run validation read-only** in the SQL editor. Never manually replay a tracked migration that migration history already contains.

### B. Approved direct SQL (exception path)

Use only with explicit live approval and a controlled `psql` session. This path is separate from GitHub Integration:

```bash
git checkout main
git pull --ff-only
git status --short --branch
cat supabase/.temp/project-ref
psql "$SUPABASE_SESSION_POOLER_URL" -v ON_ERROR_STOP=1 -f <PRE_RUN_FILE>
psql "$SUPABASE_SESSION_POOLER_URL" -v ON_ERROR_STOP=1 -f <APPROVED_FORWARD_FILE>
psql "$SUPABASE_SESSION_POOLER_URL" -v ON_ERROR_STOP=1 -f <POST_RUN_FILE>
```

Do not print the connection string. Retain outputs in the protected change record, not in Git. Direct SQL must not be used to replay tracked migrations. On rollback, disable the server flag first, obtain approval, then run:

```bash
psql "$SUPABASE_SESSION_POOLER_URL" -v ON_ERROR_STOP=1 -f <ROLLBACK_FILE>
psql "$SUPABASE_SESSION_POOLER_URL" -v ON_ERROR_STOP=1 -f <PRE_RUN_FILE>
```

## 2. Common 12-step gate procedure

For every gate:

1. Run `git checkout main && git pull --ff-only && git status --short --branch` and record the approved commit.
2. Run `cat supabase/.temp/project-ref` and `supabase projects list`; stop if production linkage is ambiguous.
3. Run the listed pre-run file read-only.
4. Compare every object, count, policy, and privilege with the gate's expected output; attach evidence and stop on any mismatch.
5. Apply the approved forward artifact through **one** workflow in section 1. For a tracked migration already in history, verify; do not replay.
6. Run the listed post-run file read-only and require PASS.
7. Run the disabled-flag smoke list; it must remain safe and read-only where specified.
8. Set the listed flag to exact string `true` in the **server runtime only**, deploy the configuration through the approved platform workflow, and confirm no `NEXT_PUBLIC_` equivalent exists.
9. Repeat the enabled smoke list, including one unauthorized fixture.
10. Monitor server/API/Supabase logs for at least the approved observation window; filter on the affected route/RPC and confirm no raw errors or authorization bypass.
11. Trigger rollback on any condition listed below or in the activation matrix.
12. Set the server flag to `false` (or remove it), verify disabled behavior, and only then execute the approved rollback artifact.

Immediate global stop conditions: unexpected row counts, missing objects, privilege mismatch, partial atomic write, cross-project/employee access, browser mutation, raw database errors, global crash, infinite loading, or fallback data written without acknowledgement.

## 3. Exact serial execution order

The serial evidence-friendly order is:

1. `FACILITY_ACTIVE_STATE_ENABLED`
2. `ATTENDANCE_RECOVERY_ENABLED`
3. `PHASE_WORKFLOW_FOUNDATION_ENABLED`
4. `PHASE_STATUS_MUTATION_ENABLED`
5. `TASK_COMMENTS_ACTIVITY_ENABLED`
6. `PROJECT_WORKFLOW_ATOMIC_CREATE_ENABLED`
7. `TASK_ASSIGNMENT_ATOMIC_CREATE_ENABLED`

Facility/Attendance and Project Workflow are independent branches. After Phase foundation, phase status and comments/activity are siblings. The two atomic-create gates are also siblings after comments/activity; their serial order is operational, not a schema dependency.

## 4. Gate cards

### 4.1 Facility active state

```bash
# Read-only pre-run (the compatibility audit is also the pre-run evidence)
psql "$SUPABASE_SESSION_POOLER_URL" -v ON_ERROR_STOP=1 -f supabase/validation/20260727_facility_employee_compatibility_audit.sql
# Forward only if not already present in migration history and using the approved direct-SQL exception
psql "$SUPABASE_SESSION_POOLER_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/20260723120000_facility_status_code.sql
# Read-only post-run
psql "$SUPABASE_SESSION_POOLER_URL" -v ON_ERROR_STOP=1 -f supabase/validation/20260723120000_facility_status_code_validation.sql
```

Expected: all required columns/indexes exist; no null/duplicate normalized code; backfill count matches the reviewed pre-run report. Disabled smoke: directory still loads; create/edit/delete controls are disabled; exact copy is “Chức năng cập nhật cơ sở đang chờ kích hoạt.” Enabled smoke: authorized admin manages a fixture; inactive facility is excluded from new Attendance matching; browser write is rejected. Roll back on duplicate/null code, count drift, write bypass, or facility/Attendance regression using `supabase/rollbacks/20260723120000_facility_status_code_rollback.sql` after disabling the flag.

### 4.2 Attendance recovery

**Current state:** application `APPLICATION_COMPLETE`; repository validation `PASS`; live Gate 2 `OPERATOR_PRODUCTION_VERIFICATION_REQUIRED`; `ATTENDANCE_RECOVERY_ENABLED=false`/unset. No production SQL or runtime activation has been performed and no live Attendance PASS is recorded.

Operator evidence order: verify migration history first; run and retain the read-only pre-run; retain post-run validation; perform authenticated production authorization and smoke checks; keep `ATTENDANCE_RECOVERY_ENABLED=false` until every result passes. The tracked forward command below is not an instruction to replay a migration already present in production history.

```bash
psql "$SUPABASE_SESSION_POOLER_URL" -v ON_ERROR_STOP=1 -f supabase/drafts/20260728_attendance_recovery_pre_run.sql
# Tracked migration: verify migration history; never replay when already applied
psql "$SUPABASE_SESSION_POOLER_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/20260715073600_attendance_recovery_rls.sql
psql "$SUPABASE_SESSION_POOLER_URL" -v ON_ERROR_STOP=1 -f supabase/validation/20260715073600_attendance_recovery_rls_validation.sql
```

Expected: both tables/functions exist; own-row and Admin permission policies match the package. Disabled smoke: normal Staff access, check-in/out, current open shift, prior-date stale-shift warning, monthly history, assigned-facility label, loading, controlled failure and in-page Retry work without Project Membership; repeated taps create only one request; Admin list works and only recovery controls remain disabled. Enabled smoke: `ATTENDANCE_MANAGE` can create/update/delete a repair; view-only, Staff cross-employee, disconnected, and inactive fixtures fail safely. Roll back on own-row regression or authorization bypass using `supabase/rollbacks/20260715073600_attendance_recovery_rls_rollback.sql` after disabling the flag.

### 4.3 Phase Workflow foundation

```bash
psql "$SUPABASE_SESSION_POOLER_URL" -v ON_ERROR_STOP=1 -f supabase/drafts/20260718_phase_workflow_foundation_pre_run_readonly_validation.sql
psql "$SUPABASE_SESSION_POOLER_URL" -v ON_ERROR_STOP=1 -f supabase/drafts/20260718_phase_workflow_foundation_final_forward.sql
psql "$SUPABASE_SESSION_POOLER_URL" -v ON_ERROR_STOP=1 -f supabase/drafts/20260718_phase_workflow_foundation_final_validation.sql
```

Expected: attached object/count/RLS checks PASS. Disabled smoke: existing phase display remains visible and read-only with no empty-state substitution. Enabled smoke: normalized metadata loads for legacy and new projects; cross-project fixtures fail. Roll back on count mismatch, orphan/duplicate phase, RLS bypass, or legacy display regression using `supabase/drafts/20260718_phase_workflow_foundation_final_rollback.sql` after disabling both phase flags.

### 4.4 Phase status mutation

```bash
psql "$SUPABASE_SESSION_POOLER_URL" -v ON_ERROR_STOP=1 -f supabase/drafts/20260728_phase_status_dependency_pre_run.sql
# Tracked migration: verify migration history; never replay when already applied
psql "$SUPABASE_SESSION_POOLER_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/20260727044729_phase_status_dependency.sql
psql "$SUPABASE_SESSION_POOLER_URL" -v ON_ERROR_STOP=1 -f supabase/validation/20260727044729_phase_status_dependency_validation.sql
```

Expected: supported status set, no duplicate order/orphan phase, RPC service-only, history policy/immutability PASS. Disabled smoke: phase display remains available and mutation returns controlled capability response. Enabled smoke: valid transition creates one audit row; stale/dependency/cross-project/contributor/cancelled cases fail. Roll back on invalid transition, missing audit, privilege/RLS bypass, or phase display regression using `supabase/drafts/20260721_phase_status_dependency_rollback.sql` after disabling status mutation (leave foundation enabled unless its own trigger fired).

### 4.5 Task comments and activity

```bash
psql "$SUPABASE_SESSION_POOLER_URL" -v ON_ERROR_STOP=1 -f supabase/drafts/20260728_task_comments_activity_pre_run.sql
psql "$SUPABASE_SESSION_POOLER_URL" -v ON_ERROR_STOP=1 -f supabase/drafts/20260728_task_comments_activity_forward.sql
psql "$SUPABASE_SESSION_POOLER_URL" -v ON_ERROR_STOP=1 -f supabase/drafts/20260728_task_comments_activity_post_run.sql
```

Expected: tables/constraints, immutable triggers, project-scoped reads and revoked browser writes PASS. Disabled smoke: exact waiting copy renders without spinner/empty substitution. Enabled smoke: bounded/cursor reads and authorized project/task comments work; client actor, cross-project, update and delete fail. Roll back on history mutation, unbounded load, actor spoofing, or access bypass using `supabase/drafts/20260728_task_comments_activity_rollback.sql` after disabling comments and both atomic-create flags.

### 4.6 Project workflow atomic create

```bash
psql "$SUPABASE_SESSION_POOLER_URL" -v ON_ERROR_STOP=1 -f supabase/drafts/20260728_project_creation_atomic_pre_run.sql
psql "$SUPABASE_SESSION_POOLER_URL" -v ON_ERROR_STOP=1 -f supabase/drafts/20260721_project_creation_atomic_rpc_forward.sql
psql "$SUPABASE_SESSION_POOLER_URL" -v ON_ERROR_STOP=1 -f supabase/drafts/20260728_project_creation_atomic_post_run.sql
```

Expected: all dependency objects exist; unique project code; RPC is invoker and service-role only. Disabled smoke: create persists one basic project and manager membership, submits no phases/tasks, returns explicit warnings, and routes using the confirmed project ID. Enabled smoke: full create is atomic; invalid assignee/status and duplicate code leave no partial rows; browser RPC is rejected. Roll back on partial write, browser execute, membership/activity omission, or unconfirmed result using `supabase/drafts/20260721_project_creation_atomic_rpc_rollback.sql` after disabling the flag.

### 4.7 Task assignment atomic create

```bash
psql "$SUPABASE_SESSION_POOLER_URL" -v ON_ERROR_STOP=1 -f supabase/drafts/20260728_task_assignment_atomic_create_pre_run.sql
psql "$SUPABASE_SESSION_POOLER_URL" -v ON_ERROR_STOP=1 -f supabase/drafts/20260721_task_assignment_atomic_create_rpc.sql
psql "$SUPABASE_SESSION_POOLER_URL" -v ON_ERROR_STOP=1 -f supabase/drafts/20260728_task_assignment_atomic_create_post_run.sql
```

Expected: dependency objects exist and RPC is invoker/service-role only. Disabled smoke: exact waiting copy displays and POST returns a controlled capability error without a legacy write. Enabled smoke: one task/activity and at most one optional comment/notification; inactive member, cross-project phase/parent, contributor and cancelled project fail; RPC failure leaves no rows. Roll back on partial/duplicate write, cross-project acceptance, inactive assignee acceptance, or privilege failure using `supabase/drafts/20260728_task_assignment_atomic_create_rollback.sql` after disabling the flag.

## 5. Configuration and monitoring evidence

Before enabling any gate, capture the platform configuration diff showing only the server variable. Never use `NEXT_PUBLIC_*`. After enablement, run the relevant application test command against the approved environment and retain timestamped route/RPC log queries. A flag-only rollback is always the first response and must be possible without database rollback.
