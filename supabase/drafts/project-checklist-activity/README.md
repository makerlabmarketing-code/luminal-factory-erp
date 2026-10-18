# E-011 corrective activity constraint — approval pending

Authenticated Production UI creation with one stage/task fails and saves no project.
A read-only inspection found that create_project_atomic emits PROJECT_CREATED,
but project_activity_activity_type_check accepts only the nine July task and
production events. A rollback-only diagnostic confirmed that empty, stage-only
and task-bearing project payloads all fail atomically. Manual rollback-only inserts
through the task event succeed. No test project/template remains in Production.

The SQL runtime regression now matches the real check constraint, reproduces
project_create_failed with zero projects, applies this fix and verifies create,
template snapshot/application, staff transitions, stale state and role guards.
The earlier fixture omitted the check, explaining its false positive.

## Exact proposed Production change

- ERP project: kwfmfmpgpbfewpiizesv.
- Add PROJECT_CREATED to the existing nine-value activity check; preserve all
  existing values and validate the complete constraint in the same transaction.
- No new table/column/index, RPC changes, RLS/policy/grant changes, seed or backfill.
- Existing rows remain unchanged. The guard rejects any changed baseline.
- Expected baseline constraint MD5: f2e2d8dd312e75c84d51ac9aadb109fd.
- Forward SHA-256: 366d6a037cf0f55f1682ddebdaf586c41fb7311ae4b72293cc789c71a5dee909.
- A five-second lock timeout bounds lock acquisition. Validation reads existing
  activity rows under the transaction; plan for a short schema lock.

## Delivery and acceptance

This package is unapproved and stays outside supabase/migrations. The earlier
approval covered the checklist function package, not this constraint correction.
After approval, recheck exact hash/baseline, apply once through the explicitly
authorized delivery path and reconcile the observed ledger version in Git.
Run validation.sql and repeat authenticated UI creation/save/reload/template
selection and staff/manager acceptance; do not call build readiness acceptance.

## Rollback

rollback.sql restores the old constraint only before any PROJECT_CREATED rows
exist. It refuses once new history exists, preserving all audit data. After first
use, roll back application/flags instead; never delete audit rows for rollback.
The runtime suite verifies restoration before use and refusal after use.

Run:
PGLITE_MODULE=/absolute/path/to/@electric-sql/pglite/dist/index.js node supabase/drafts/project-checklist/test.mjs

The suite uses local auth stubs and is SQL contract evidence, not a live RLS or
two-session authenticated acceptance result.

Validation: SQL regression suite, 969 Vitest tests, lint, TypeScript, clean-cache production build and diff check PASS. Initial build failed on a corrupt Turbopack persistence cache; a clean generated cache resolved it without source changes.
