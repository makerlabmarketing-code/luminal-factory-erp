# Production Operator SQL Handoff

## Atomic normalized child-task creation

- **Status:** `READY_FOR_OPERATOR`
- **Affected objects:** `public.create_project_task_atomic(...)`; reads/writes existing `public.tasks`, `public.task_comments`, `public.project_activity`, and `public.task_notifications`.
- **Expected row-count effect during rollout:** zero. The forward DDL only creates/replaces a function. Each later successful application call creates exactly one task, one activity row, zero-or-one comment, and zero-or-one assignment notification.
- **Authorization/RLS impact:** the function is `SECURITY INVOKER`. Revoke `PUBLIC`, `anon`, and `authenticated`; grant execution only to `service_role`. Application authorization remains server-derived before the RPC call. Existing table RLS remains unchanged.

### Exact order

1. Keep `TASK_ASSIGNMENT_ATOMIC_CREATE_ENABLED` unset or `false`.
2. Run `supabase/drafts/20260728_task_assignment_atomic_create_pre_run.sql` read-only and retain the output. Stop if any required table is missing or the existing signature is unexpected.
3. Review and deliver `supabase/drafts/20260721_task_assignment_atomic_create_rpc.sql` through the protected migration workflow, adding explicit function EXECUTE revokes/grant in the promoted migration.
4. Run `supabase/drafts/20260728_task_assignment_atomic_create_post_run.sql`. PASS requires invoker security, no anon/authenticated execute, and service-role execute.
5. Enable `TASK_ASSIGNMENT_ATOMIC_CREATE_ENABLED=true` only in the server runtime.
6. Run the smoke tests below with an authorized fixture project, then an unauthorized/cross-project fixture.

### Smoke tests

- Authorized Project Owner or Project Manager creates a task in an unlocked phase; exactly one task and one `TASK_CREATED` activity appear.
- Optional initial comment and assignment create at most one related row each.
- ACTIVE project-member assignee is accepted by employee ID; inactive/non-member and cross-project phase IDs are rejected.
- Contributor and cancelled-project mutations are rejected according to server capabilities.
- Double click produces one request because the dialog is disabled while saving.
- Failed RPC leaves no partial task, comment, activity, or notification rows.

### Rollback

- **Artifact:** `supabase/drafts/20260728_task_assignment_atomic_create_rollback.sql`.
- **Trigger:** privilege validation fails, atomicity smoke test fails, authorization bypass is observed, or the RPC result cannot be confirmed.
- Disable the runtime flag first, run rollback through the approved operator path, and retain historical rows. Never hard-delete created tasks as part of rollback.

## Facility production data verification

- **Status:** `LIVE_OPERATOR_VERIFICATION_REQUIRED`
- Preserve the existing facility audit and reconciliation artifacts. Do not mutate live facility or attendance rows from Cloud.

## Phase Workflow production capability

- **Status:** `LIVE_OPERATOR_VERIFICATION_REQUIRED`
- Preserve the existing capability gate until operator validation confirms the promoted workflow migration and post-run checklist.
