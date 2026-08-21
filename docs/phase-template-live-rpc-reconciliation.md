# Phase Template Live RPC Reconciliation

**Checked:** 2026-08-21
**Production project:** `kwfmfmpgpbfewpiizesv`
**Status:** `READ_ONLY_PASS / OPTION_1_APPROVED`
**Mutation count:** 0

## Read-only boundary

The production query ran inside `BEGIN TRANSACTION READ ONLY` and ended with
`ROLLBACK`. It read only function catalog/ACL/configuration and selected column
metadata. It did not execute the function, inspect business rows, run DDL/DML,
change grants, write migration history, or alter a runtime flag.

## Exact live boundary

- Signature: `public.create_project_atomic(jsonb)`.
- Definition checksum: `md5 = f893db4f9c021120ea697badda853cb9`.
- Language/security: PL/pgSQL `SECURITY DEFINER`, owner `postgres`.
- Search path: `public, auth, pg_temp`.
- ACL: owner, `authenticated`, and `service_role` have execute; `anon` does not.
- The body derives `auth.uid()`, resolves an active employee, requires
  `ADMIN_WORKSPACE` plus `PROJECT_MANAGE`, rejects client actor fields, and
  creates the project/membership/phases/tasks/activity in one function.

This confirms that the replacement must preserve the authenticated RPC security
contract. A second browser-executable template-apply RPC remains prohibited.

## Newly exposed contract gap

The approved template contract anchors stage offsets to project start. The live
schema has `projects.project_deadline` and nullable `projects.created_at`, but no
`projects.start_date` or `projects.project_start_date`. The live RPC does not
read payload `startDate`. `phases.planned_start_date` and
`phases.planned_end_date` are nullable `text`; `tasks.deadline` is nullable
`timestamptz`.

The business owner approved Option 1 on 2026-08-21:

1. **Approved:** require `startDate` when a template is selected and add a
   canonical nullable `projects.start_date date`; compatibility creates may
   keep it null.

The rejected alternatives were using a non-persisted payload-only anchor or the
transaction calendar date. Option 1 preserves the scheduling anchor for audit,
later display, and deadline recalculation without rewriting existing projects.
It adds one nullable column and no backfill. An offset-derived date beyond
`project_deadline` must reject the whole transaction.

## Exact next gate

The exact live-function replacement and lifecycle-management package are now
prepared for protected review. Next, apply them only to a safe non-production
database and retain authorized/denied, stale-version, contiguous-order,
role-resolution, deadline-overflow, forced-failure, and zero-partial-persistence
fixtures. Keep `PHASE_TEMPLATES_ENABLED` false/unset and all SQL outside
migrations until that evidence and separate production approval exist.
