# Corrective Slice 6 Production Order and Colorway Workflow Handoff

Date: 2026-07-22

## Completed application scope

- Added `lib/production-order-workflow.ts` as the application-owned production order workflow contract.
- Production orders use stable `productionOrderId` and unique `productionCode`; display names remain non-authoritative.
- Workflow templates are reusable data objects. The artisan keycap template is provided as an approved template and is not hardcoded into a UI component.
- Template preview creates stages and tasks in memory before persistence so project/order creation can show generated work safely.
- Atomic creation is represented by `createProductionOrderAtomically(input, adapter)`, which checks duplicate production codes and delegates all persistence to a single adapter transaction boundary.
- Stage gating enforces sequential activation, required task completion, review approval before reviewed stage completion, locked-stage edit blocking, duplicate active-stage prevention, explicit override reasons, and read-only completed-stage semantics at the domain boundary.
- Task assignment requires an active eligible project member.
- Dashboard/detail helpers expose production summaries and a mobile-safe detail structure.
- Notification hooks are idempotent by key to avoid duplicate stage notifications.
- Material requirements are prepared as order-level placeholders only. Existing inventory structures must be inspected before any stock reservation or usage mutation is enabled.

## Not changed

- No schema, migration, new RPC, RLS policy, permission catalog, inventory mutation, backfill, feature flag enablement, live data mutation, destructive cleanup, deployment, or production SQL was executed.
- No completed authorization, employee lifecycle, project creation, finance, project execution, or permission work was repeated.
- No parallel inventory system was introduced.

## Approval boundary retained

Before durable production-order persistence or inventory usage can be enabled, prepare and approve:

- forward SQL/RPC artifact
- rollback artifact
- validation SQL
- RLS/security plan
- compatibility and backfill plan
- inventory stock mutation plan

Current stop condition for those artifacts: `LIVE_APPROVAL_REQUIRED`.

## Management API verification exception

If Supabase Management API verification returns Cloudflare Error 1010 / `browser_signature_banned`, HTTP 403 from `api.supabase.com` with that confirmed infrastructure restriction, or another confirmed infrastructure restriction unrelated to repository correctness, record `MANAGEMENT_API_UNAVAILABLE`. This is an environment limitation, not a slice failure. Skip only Management API project metadata and health verification; continue using the reviewed migration package, rollback package, validation SQL, compatibility/backfill plan, application contract, and reviewed RPC contract. Do not downgrade safety, run unapproved live SQL, mutate RLS, backfill data, deploy RPCs, bypass `LIVE_APPROVAL_REQUIRED`, or ignore validation failures unrelated to the Management API limitation.

## Validation notes

Focused regression coverage was added in `tests/production-order-workflow.test.ts` for template preview, atomic creation adapter behavior, stable identity, duplicate production code rejection, sequential stage gating, review requirement, locked-stage edit prevention, override reason, assignment eligibility, required-task completion, progress calculation, blocked/overdue summaries, duplicate notifications, mobile-safe detail structure, and no partial persistence.

## 2026-07-22 live persistence continuation preflight

Status: `BLOCKED_MISSING_REVIEWED_ARTIFACT`.

Live mutation did not run. The continuation confirmed the target project through the Management API and local Supabase link metadata, then stopped before any DDL/RLS/RPC/backfill because the repository does not contain the reviewed Corrective Slice 6 production-order persistence package required by the live-approval scope.

Preflight confirmations:

- `MANAGEMENT_API_READY`: `https://api.supabase.com/v1/projects/kwfmfmpgpbfewpiizesv` returned project `Luminal Factory` with status `ACTIVE_HEALTHY`.
- `CLI_READY`: `npx supabase --version` returned `2.109.1`; `npx supabase projects list --output json` listed the linked `Luminal Factory` project despite a non-blocking PostHog telemetry 403.
- `PROJECT_LINK_MATCH`: `supabase/.temp/project-ref` and `SUPABASE_PROJECT_REF` both resolved to `kwfmfmpgpbfewpiizesv`.
- Read-only Management API database query succeeded with HTTP 201 and showed no existing production-order tables, routines, or migration-history entries matching the reviewed scope names checked by pre-validation.
- Existing compatibility tables checked by pre-validation are present: `projects`, `phases`, `tasks`, `project_members`, `task_comments`, and `task_notifications`.
- Pre-validation found no checked inventory/stock/procurement mutation routines in the live schema.

Required reviewed artifacts still missing from the repository:

- Corrective Slice 6 forward SQL/RPC package.
- Corrective Slice 6 rollback package.
- Corrective Slice 6 validation SQL package.
- Corrective Slice 6 compatibility/backfill package.
- Corrective Slice 6 RLS/security package.
- Corrective Slice 6 attachment-policy package.
- Corrective Slice 6 notification-outbox integration package.

Per the task stop conditions, the missing reviewed artifacts block live persistence, SQL validation, RPC rollout, and application wiring. No production SQL, RLS mutation, RPC deployment, backfill, inventory quantity mutation, application persistence-gate removal, deployment, or live data mutation was executed.

## 2026-07-22 reviewed persistence package prepared

Status: `LIVE_APPROVAL_REQUIRED`.

Prepared the complete draft persistence package under `supabase/drafts/corrective-slice-6-production-order-persistence/` without executing SQL, running a migration, deploying, backfilling, or mutating live data.

Package contents:

- `forward.sql` for durable production orders, workflow templates, template stages, production stages, production members, stage dependencies, material requirement placeholders, protected attachment metadata, activity integration, notification integration, and transactional RPCs.
- `rollback.sql` with guarded preconditions that block destructive rollback when operational production rows, production activity, production notification rows, or attachment metadata exist.
- `validation.sql` with read-only object, uniqueness, RLS/grant, orphan, circular-dependency, active-stage, rollback-readiness, and inventory non-mutation checks.
- `compatibility.sql` for security-invoker list/detail views over durable production persistence.
- `security/RLS.sql` for select-only authenticated RLS plus restricted RPC execution grants.
- `attachment-policy.sql` for protected metadata access only; no public storage/object access is created.
- `notification-outbox.sql` to reuse `task_notifications` with production context and a `dedupe_key`; no parallel notification system is introduced.
- `backfill-plan.md` documenting that no automatic legacy backfill is safe without a future approved deterministic mapping.
- `REVIEW.md` recording self-review of reuse, authorization, workflow enforcement, rollback, and no-inventory-mutation boundaries.

No live mutation was performed. The next step is read-only pre-validation followed by an explicit live-approval gate for this exact reviewed package.

## 2026-07-22 Live persistence execution attempt

Scope approved: only the reviewed `supabase/drafts/corrective-slice-6-production-order-persistence/` package, including forward SQL, transactional RPCs, rollback, validation, compatibility views, RLS/security, attachment metadata policy, notification outbox integration, grants, indexes, and constraints.

Execution result: `LIVE_EXECUTION_BLOCKED_BY_DATABASE_NETWORK`.

- `npx supabase db query --linked --file supabase/drafts/corrective-slice-6-production-order-persistence/forward.sql` reached the linked-project login-role step, then the CLI repeatedly failed inside its database connection attempt with `TypeError: null is not an object (evaluating 'context')` from `internalConnectMultipleTimeout`.
- A direct TCP probe to `aws-1-ap-northeast-1.pooler.supabase.com:5432` failed with `Network is unreachable`, confirming the SQL execution path is unavailable from this environment rather than a reviewed-package redesign issue.
- No application logic was changed, no Slice 7 work was started, and no unreviewed SQL was substituted.
- Because the forward package did not execute, post-apply SQL validation, production-order creation, workflow template creation, stage transitions, production member assignment, attachment metadata, notification outbox, permission enforcement, duplicate protection, and rollback-safety verification could not be completed against the live database in this run.

Next allowed action: rerun the exact reviewed package from an environment with database connectivity, starting with `npx supabase db query --linked --file supabase/drafts/corrective-slice-6-production-order-persistence/forward.sql`, then apply the remaining reviewed files in package order and run `validation.sql`. Do not continue Slice 7 until Slice 6 live validation succeeds.
