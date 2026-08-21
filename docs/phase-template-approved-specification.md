# Phase Template Approved Specification

**Approved:** 2026-08-20
**Status:** `PRODUCTION_MIGRATION_PROMOTED_AWAITING_PROTECTED_MAIN`
**Decision authority:**
[Phase Template Business-Decision Package](phase-template-business-decision.md)

## Delivery boundary

This specification translates the approved Option A contract into a reviewable
release-one design. The read-only production preflight at
`supabase/drafts/20260820_phase_template_schema_preflight.sql` passed with the
result recorded in
[phase-template-schema-preflight-result.md](phase-template-schema-preflight-result.md).

The business owner explicitly approved direct production delivery on 2026-08-21
after the repeated read-only preflight matched the retained checksum and source
counts. The approved SQL is promoted atomically at
`supabase/migrations/20260821065313_phase_template_release_one.sql`. This
approval does not authorize seed insertion or runtime activation. The superseded
`20260716_project_detail_phase_workflow_template_proposal.sql` remains a
non-executable historical sketch.

## Release-one behavior

- A template has a stable identity and belongs to project type `GENERAL`.
- Each template version is `DRAFT`, `PUBLISHED`, or `ARCHIVED`.
- Drafts are editable. Published versions are immutable.
- Publishing increments the version atomically and makes exactly one version
  current for its template.
- Applying a current published version clones stages and default tasks into one
  newly created project and records provenance in the same transaction.
- Applying never creates a live dependency from project rows back to template
  content. Later template publication or archive cannot alter an existing
  project.
- Release one rejects backfill, reapply, replace, merge, and upgrade operations.
- The launch seed catalog is intentionally empty.

## Authorization contract

| Operation | Required authority | Browser table write |
|---|---|---|
| List active published templates | Admin Workspace plus existing project-create/manage authority | None |
| Apply a template | Existing project-create authority; server rechecks the selected current version | None |
| View drafts, archives, versions, provenance, or audit | Admin Workspace plus `PHASE_TEMPLATE_MANAGE` | None |
| Create/edit a draft | Admin Workspace plus `PHASE_TEMPLATE_MANAGE` | None |
| Publish/archive/restore | Admin Workspace plus `PHASE_TEMPLATE_MANAGE`; reason required | None |
| Delete unused draft | Admin Workspace plus `PHASE_TEMPLATE_MANAGE`; never published/applied; reason required | None |

`PROJECT_MANAGE`, project membership, and phase roles do not independently
grant template maintenance. Actor employee ID and timestamps are server-derived.
The application must fail closed when the account, workspace, permission, role,
template, version, or project-type check is unavailable.

## Proposed relational model

Exact names and column types remain subject to the schema preflight. The forward
design should provide these logical objects without reusing any colliding legacy
object:

1. `phase_templates`: stable identity, normalized unique name, `GENERAL`
   project type, lifecycle pointer, creator, and timestamps.
2. `phase_template_versions`: positive version number, lifecycle, publication
   and archive actors/timestamps/reasons, and immutable publication metadata.
3. `phase_template_stages`: contiguous one-based order, normalized unique name
   per version, non-negative project-start offset, optional duration/description,
   and no arbitrary dependency graph.
4. `phase_template_tasks`: contiguous one-based order per stage, name,
   `is_required`, `requires_review`, optional approved project-role placeholder,
   and non-negative stage-start offset.
5. `phase_template_applications`: immutable project/version provenance, actor,
   timestamp, and clone result summary; one application maximum per project in
   release one.
6. `phase_template_audit`: append-only actor, timestamp, action, mandatory
   reason for publish/archive/restore/delete, and structured before/after data.

All employee and project references use `ON DELETE RESTRICT`, except optional
historical display fields that preflight proves require a different existing
compatibility pattern. Template content must not store a concrete employee ID.

## Invariants

- Template and stage names are compared after trim and case normalization.
- One template version number is unique within one stable template.
- One current published version exists at most; a template with no published
  version cannot be selected.
- A published version has at least one stage.
- Stage order starts at 1 and has no gaps or duplicates.
- Task order starts at 1 within each stage and has no gaps or duplicates.
- Allowed role placeholders are `PROJECT_OWNER`, `PROJECT_MANAGER`,
  `CREATIVE_LEAD`, and `CONTRIBUTOR` only.
- Missing active project membership for a placeholder produces a visible
  unassigned task. It never selects an unrelated employee.
- Calendar offsets are whole, non-negative days. A derived stage/task deadline
  beyond the project deadline rejects the entire apply transaction.
- Published content, application provenance, and audit rows cannot be updated or
  deleted.
- An unused draft may be hard-deleted only if it has never been published,
  applied, or used as the source of another version, and the delete audit is
  retained.
- Audit rows are retained for seven years. Expiry processing is out of release
  one; no automatic deletion job is approved.

## Transaction boundaries

The future forward package requires server-owned atomic operations for:

- create draft;
- edit draft content;
- clone an existing version to a new draft;
- publish draft;
- archive/restore current version;
- delete eligible unused draft; and
- apply current published version during project creation.

Every operation locks the authoritative template/version rows, rechecks current
actor authorization in the transaction, validates the complete aggregate, and
either commits all rows plus audit/provenance or persists nothing.

Functions should use `SECURITY INVOKER` wherever the existing server database
role can satisfy the operation. Preflight confirmed that live atomic project
creation intentionally uses an authenticated `SECURITY DEFINER` RPC so the
database can derive `auth.uid()` and perform the complete project clone while
bypassing tables that expose no browser mutation policy. Release-one template
apply should extend that existing boundary rather than add a second apply RPC.

Every necessary `SECURITY DEFINER` exception must derive the actor from
`auth.uid()`, recheck active employee/workspace/permission inside the
transaction, reject client actor fields, use a pinned/empty `search_path`,
revoke `EXECUTE` from `PUBLIC` and `anon`, and grant `authenticated` only to the
exact reviewed signature. Direct browser table writes remain prohibited. The
generic Supabase Advisor warning is acceptable only with an explicit rationale
and retained authorized/denied/atomicity evidence.

## RLS and grants

- Enable RLS on every new `public` table.
- Grant no browser insert, update, or delete privilege.
- `anon` receives no table or function privilege.
- `authenticated` receives only the minimum select surface needed for eligible
  Admin Workspace reads, with ownership/capability predicates in RLS; `TO
  authenticated` alone is insufficient authorization.
- Draft, archive, version-history, provenance, and audit reads require
  `PHASE_TEMPLATE_MANAGE` unless a narrower application-provenance projection is
  later approved.
- Views, if any, must be `security_invoker = true` and must not bypass underlying
  RLS.
- Service-role execution remains server-only and is never exposed through a
  `NEXT_PUBLIC_` environment variable.

These rules follow the current Supabase guidance that exposed-schema tables
must have RLS enabled, function execution is public by default unless revoked,
and `SECURITY INVOKER` is preferred.

## Compatibility

- Existing `projects`, `phases`, `tasks`, and current project-creation behavior
  remain unchanged until the template runtime gate is separately activated.
- Production workflow templates are a separate domain and must not be reused or
  migrated into Phase Templates.
- The old hard-coded or UI-side project presets remain available as fallback
  while the new runtime capability is absent or false.
- No existing project is classified, backfilled, or linked to a template.
- Release-one project type is `GENERAL`; adding another type requires a reviewed
  catalog change and compatibility evidence.

## Required package after preflight review

If preflight finds no blocker, the next bounded repository slice must include:

1. formal forward migration generated through the repository's canonical
   migration workflow;
2. rollback that disables selection first and preserves applied project rows,
   provenance, and audit;
3. post-run validation for schema, constraints, indexes, RLS, policies, grants,
   function security, and permission catalog;
4. authorization/atomicity fixtures for allowed and denied actors, invalid
   order, duplicate names, stale version, cross-project identifiers, deadline
   overflow, missing role member, forced failure, and zero partial persistence;
5. server contracts and default-disabled runtime flag;
6. focused tests plus full repository validation; and
7. a separate protected review before production delivery or activation.

All seven repository artifacts are prepared, and the approved forward package
is promoted to one protected-main migration. The
authorization/atomicity fixture is packaged at
`supabase/validation/20260821_phase_template_nonproduction_fixture.sql` and is
explicitly `NOT_EXECUTED`; its no-cost/non-production boundary is owned by
[phase-template-nonproduction-fixture-runbook.md](phase-template-nonproduction-fixture-runbook.md).

## Stop conditions

Stop on any legacy object collision, unknown project/phase/task column contract,
permission-catalog conflict, browser write/execute grant, RLS bypass, mutable
published row, partial clone, cross-project reference, implicit employee
assignment, deadline overflow persistence, non-empty unapproved seed, existing
project rewrite, or production count drift.

## Exact next gate

Merge PR #177 through protected `main`, let the configured Supabase GitHub
Integration apply migration `20260821065313_phase_template_release_one`, then
run the read-only post-validation and compare source counts. The non-production
fixture remains `NOT_EXECUTED` because no no-cost ERP test database exists; the
business owner explicitly accepted direct production delivery. Keep
`PHASE_TEMPLATES_ENABLED=false` or unset after validation.
