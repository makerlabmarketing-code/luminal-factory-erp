# Project checklist SQL review package

Status: DRAFT, explicit production approval pending. No execution performed.
Forward SHA-256: `13e50bdb351004fe4436ed998fe5755dd24c92a1e9b964eafd418919eb7cf259`.

## Scope and compatibility

Replaces only create_project_atomic(jsonb), preserving the existing template
application and authorization paths while persisting checklist metadata and
validating task/phase links. Adds update_staff_checklist_task (service_role only,
SECURITY INVOKER) and save_project_template_atomic (authenticated, SECURITY
DEFINER with employee/workspace/permission/project visibility checks).
No tables, policies, enum changes, backfills, seeds or employee grants.
The snapshot helper publishes via the existing management RPC in one transaction.
Existing projects and immutable template provenance remain independent.

The forward transaction takes an advisory lock and refuses drift from the
read-only inspected create-project definition MD5
`8b41f85245ff7cd18623624d8c5af811`, or preexisting helper names.
A mismatch requires fresh review; never replace the guard to bypass it.
previous-function.sql is the inspected rollback baseline. replacement-function.sql
and checklist-functions.sql are review extracts; forward.sql is the sole install
artifact. Never run the extracts separately in production.

## Delivery after approval

1. Recheck baseline checksum, expected tables/columns, helper absence and flag
   state using read-only queries. Confirm correct ERP project kwfmfmpgpbfewpiizesv.
2. Promote the approved forward.sql into supabase/migrations; keep rollback and
   validation outside. Deliver through the configured GitHub integration.
3. Run validation.sql. anon_staff, browser_staff and anon_template must all be
   false; only service_role executes the staff RPC. Snapshot auth checks apply
   even if a privileged caller invokes it without a user session.
4. Deploy the app after database success; enable the project/template flags with
   existing permissions. Complete authenticated project/staff/manager smoke from
   docs/project-checklist-handoff.md. Feature flags do not gate the staff RPC
   dependency, so the app must not precede SQL.

## Validation and rollback

Local PostgreSQL runtime test:
`PGLITE_MODULE=/absolute/path/to/@electric-sql/pglite/dist/index.js node supabase/drafts/project-checklist/test.mjs`
The runtime package is external to this repository; alternatively install
@electric-sql/pglite in a disposable environment. Fixtures create no live data.
The local test substitutes only its local pg_get_functiondef checksum because
PostgreSQL formatting may vary, then tests the real guarded transaction, rejection
on reinstall and rollback. It also covers comment/publication failure rollback,
cloning without stale data, denied roles and forbidden status transitions.
Permission stubs do not replace live RLS/auth checks.

Rollback order: disable flags, deploy the previous application, run rollback.sql.
No project/task/template data is deleted. Restore the prior function exactly and
drop the two helpers. Retain data created under the new app; do not silently
remove operational history. No backfill or reverse backfill is needed.
