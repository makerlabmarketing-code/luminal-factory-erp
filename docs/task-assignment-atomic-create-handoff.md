# Task Assignment atomic create handoff

## Delivery status

`LIVE_OPERATOR_VERIFICATION_REQUIRED`; production milestone is
`PRODUCTION_MIGRATION_PASS / RUNTIME_FLAG_DISABLED` and
`TASK_ASSIGNMENT_ATOMIC_CREATE_ENABLED` must stay false or unset.

PR #174 merged to protected `main` at
`fd989138e53a09bda9c7907c2d7e3e234a387d6e`. Vercel reported a successful
deployment, and the configured Supabase GitHub Integration applied migration
`20260815165046_task_assignment_atomic_create` exactly once to production
project `kwfmfmpgpbfewpiizesv`. The rollout changed only the RPC catalog and
grants; no live task, comment, activity, notification, backfill, or RLS row was
created or changed.

## Delivered boundary

- `createProjectTask` keeps server-derived project authorization, relationship
  pre-validation, and the fail-closed runtime gate. It invokes exactly one RPC
  and maps known database rejections to controlled Vietnamese API responses.
- `create_project_task_atomic(...)` uses `SECURITY INVOKER`, pins its search
  path, accepts a `timestamptz` deadline, and is executable only by
  `service_role`.
- The RPC locks the project row, rejects closed projects, independently checks
  actor authorization, verifies same-project phase/parent relationships, and
  requires an active project-member assignee backed by an active Employee.
- One successful transaction writes exactly one task and one `TASK_CREATED`
  activity, plus at most one trimmed initial comment and one assignment
  notification. Any validation or side-effect failure rolls the transaction
  back.
- The migration removes the superseded date-only function signature if it was
  installed outside migration history, so no parallel browser-callable RPC
  remains.

## Package

1. Read-only pre-run:
   `supabase/validation/20260815165046_task_assignment_atomic_create_pre_run.sql`
2. Protected migration delivery:
   `supabase/migrations/20260815165046_task_assignment_atomic_create.sql`
3. Read-only post-run validation:
   `supabase/validation/20260815165046_task_assignment_atomic_create_validation.sql`
4. Separately approved rollback:
   `supabase/rollbacks/20260815165046_task_assignment_atomic_create_rollback.sql`

The forward migration changes only the RPC catalog and grants; it backfills no
rows. Existing task-assignment tables, constraints, RLS, and historical rows
remain unchanged.

## Operator gate

Completed production gates:

1. Migration history contains `20260815165046` exactly once.
2. Read-only validation passed: `SECURITY INVOKER`, pinned `public, pg_temp`
   search path, no `PUBLIC`/`anon`/`authenticated` execution, and
   `service_role` execute only. The old date-only signature is absent.
3. Invalid-assignee, cross-project phase, and cross-project parent integrity
   counts are zero. Task/comment/activity/notification counts stayed zero before
   and after validation.

Remaining gates:

1. Use non-production fixtures for Project Owner/Manager success, Contributor
   denial, inactive/non-member assignee, cross-project phase and parent,
   cancelled/archived project, optional comment/assignee, and forced side-effect
   failure.
2. Compare task/comment/activity/notification counts around rejected and forced
   failures; every failure must leave zero partial rows.
3. Request separate runtime configuration approval. Enable the server-only flag
   only after every preceding check passes, then run the Project Detail create
   smoke and duplicate-submit check.

Do not create these fixtures in production. If no safe non-production database
is available, leave the runtime flag disabled and keep this gate pending.

Stop on migration-history absence, missing dependencies, unexpected function
signature, browser execute privilege, authorization drift, relationship bypass,
partial persistence, raw database-error exposure, or validation count drift.

## Rollback

First set `TASK_ASSIGNMENT_ATOMIC_CREATE_ENABLED=false` or unset. The reviewed
rollback revokes and drops only the function. It intentionally retains tasks,
comments, activity, and notifications from successful calls; there is no
automatic business-data deletion. Running the rollback requires separate live
approval.

## Review and validation state

Repository review confirmed one authoritative forward migration, separate
read-only pre/post artifacts, a non-destructive rollback, and fail-closed
application wiring. Production evidence confirms the intended signature and
privilege boundary without creating a fixture row. The separate framework
security remediation upgrades to patched Next.js 16.3.1 and records zero audit
findings plus the full test/lint/type/build gates in
`docs/ERP_IMPLEMENTATION_ROADMAP.md`; it does not change this RPC or its runtime
state.
