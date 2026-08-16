# Task Assignment atomic create handoff

## Delivery status

`READY_FOR_PROTECTED_REVIEW`; production state remains
`LIVE_OPERATOR_VERIFICATION_REQUIRED` and
`TASK_ASSIGNMENT_ATOMIC_CREATE_ENABLED` must stay false or unset.

The application and reviewed database package are complete on
`codex/task-assignment-atomic-hardening`. No Vercel deployment, production SQL,
RPC call, RLS mutation, runtime-flag activation, or live task mutation belongs
to this delivery.

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

After protected-main merge and canonical Supabase GitHub Integration delivery:

1. Confirm migration history contains `20260815165046` exactly once.
2. Run the read-only validation and require invoker security, the pinned search
   path, no `PUBLIC`/`anon`/`authenticated` execution, and `service_role` execute.
3. Use non-production fixtures for Project Owner/Manager success, Contributor
   denial, inactive/non-member assignee, cross-project phase and parent,
   cancelled/archived project, optional comment/assignee, and forced side-effect
   failure.
4. Compare task/comment/activity/notification counts around rejected and forced
   failures; every failure must leave zero partial rows.
5. Request separate runtime configuration approval. Enable the server-only flag
   only after every preceding check passes, then run the Project Detail create
   smoke and duplicate-submit check.

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
read-only pre/post artifacts, a non-destructive rollback, no dependency or
lockfile change, and fail-closed application wiring. Current Codex GitHub review
findings and unresolved PR conversations are unavailable in this checkout, so
the delivery records `REVIEW_SOURCE_UNAVAILABLE` and relies on focused tests,
the full repository gates, static SQL contract checks, and diff review. Focused tests pass 12/12; the full suite passes 746/746; lint, TypeScript, production build, and whitespace validation pass.

`npm audit --json` reports 9 vulnerable package nodes: 1 critical, 7 high,
and 1 moderate. The critical direct dependency is Next.js; PostCSS is also a
direct high-severity dependency. The remaining findings are transitive
(`@typescript-eslint/parser`, `@typescript-eslint/typescript-estree`,
`brace-expansion`, `js-yaml`, `minimatch`, `nanoid`, and `zod`). npm reports a
non-major Next.js remediation candidate, but dependency remediation is a
separate reviewed slice because it changes the framework/lockfile and must run
the full regression gates. No audit fix, dependency update, or lockfile change
was performed here.
