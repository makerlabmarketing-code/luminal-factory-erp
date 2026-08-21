# Phase Template Security Review

**Status:** `PRODUCTION_MIGRATION_PROMOTED_AWAITING_PROTECTED_MAIN`

## Trust boundaries

- The browser may read only rows allowed by RLS. It has no table mutation grant.
- The server owns the runtime flag and returns no template data while the flag is
  absent or not exactly `true`.
- `templateVersionId` is rejected while disabled and cannot be combined with
  client-supplied phases or tasks.
- `PHASE_TEMPLATE_MANAGE` is dedicated. The Project Manager preset does not
  receive it automatically.
- Published content, application provenance, and audit history are immutable.

## Retained stop condition

The schema foundation alone did not replace the live
`create_project_atomic(jsonb)` body. Production preflight proved that its live
definition differed from the older repository draft, so the package first
captured and checksum-guarded the reviewed live baseline to avoid dropping later
security and workflow repairs.

The subsequent read-only live reconciliation is recorded in
[phase-template-live-rpc-reconciliation.md](phase-template-live-rpc-reconciliation.md).
It confirmed the exact RPC checksum/security boundary and exposed that the live
project table had no canonical start-date column. The business owner approved
Option 1: a nullable canonical `projects.start_date`, required only for template
apply, with no legacy backfill.

The review package now includes the checksum-guarded exact RPC replacement at
`supabase/drafts/20260821_phase_template_create_project_atomic_replacement.sql`
and the authorized lifecycle RPC at
`supabase/drafts/20260821_phase_template_management_atomic.sql`.

The remaining authorization/atomicity matrix is now packaged, but not executed,
at `supabase/validation/20260821_phase_template_nonproduction_fixture.sql`, with
the operator boundary in
[phase-template-nonproduction-fixture-runbook.md](phase-template-nonproduction-fixture-runbook.md).
The fixture requires an explicitly confirmed existing non-production database,
uses placeholder-only identities, forces a failure after partial writes, checks
zero partial persistence, and rolls its transaction back. It must not trigger a
paid Supabase branch or be substituted with production.

The production-direct exception approved by the business owner on 2026-08-21
promotes the exact reviewed package to
`supabase/migrations/20260821065313_phase_template_release_one.sql`. The
following matrix remains the required retained verification contract:

1. actor derivation from `auth.uid()` and internal permission checks remain;
2. the selected version is the locked current `PUBLISHED` version;
3. stage/task order is contiguous and template order `n` becomes phase order
   `n - 1`;
4. role placeholders resolve only through active project membership, otherwise
   remain visibly unassigned;
5. derived deadlines never exceed the project deadline;
6. provenance and audit are inserted in the same transaction; and
7. every forced failure leaves zero project, phase, task, provenance, or audit
   rows.

No second browser-executable apply RPC is allowed. The non-production fixture
remains `NOT_EXECUTED` because no no-cost ERP test database exists. Production
delivery therefore remains default-disabled: `PHASE_TEMPLATES_ENABLED` must stay
absent/false through migration, post-validation, and application deployment.
