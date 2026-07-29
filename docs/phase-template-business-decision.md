# Phase Template Business-Decision Package

**Prepared:** 2026-07-29  
**Status:** `BLOCKED_BY_BUSINESS_DECISION`
**Boundary:** contract proposal only; no Phase Template application code, SQL, migration, RPC, RLS, seed data, runtime flag, deployment, or merge is authorized by this document.

## Current repository boundary

The application can persist phase metadata on project-owned rows, and a deferred SQL sketch names possible template tables. Neither artifact establishes an approved reusable-template owner, permission, lifecycle, or production schema. Phase Templates remain separate from project phase management and current project-creation presets.

Attendance is not part of this decision. Attendance application work is complete, repository validation is `PASS`, and its live gate remains `OPERATOR_PRODUCTION_VERIFICATION_REQUIRED`. `ATTENDANCE_RECOVERY_ENABLED=false` must remain unchanged; retained Facility production evidence is a prerequisite. This package performed no SQL, deployment, runtime activation, or live verification.

## Bounded options

### Option A — governed, project-type-scoped immutable versions (**recommended**)

The Operations/System Owner is accountable. A dedicated `PHASE_TEMPLATE_MANAGE` capability lets approved Admin Workspace operators create a draft, edit only drafts, publish numbered immutable versions, and archive templates. Active templates are visible to eligible project creators. Applying a version clones its stages and default tasks and records provenance; later edits never alter existing projects.

**Benefits:** reproducible history; global configuration is separate from routine project work; relevant catalogs by project type; safe audit and rollback boundaries.

**Risks:** requires version, provenance, permission, RPC, RLS, and audit objects; corrections require a new version; project-type vocabulary and seeds require approval.

### Option B — global templates with immutable published versions

Templates are visible for every project type. The dedicated manager permission and clone-on-apply behavior remain the same as Option A.

**Benefits:** simplest discovery model; supports cross-category workflows; preserves history.

**Risks:** catalog noise and wrong-template risk; product-specific workflows need naming conventions or duplication; later scoping requires classification work.

### Option C — project-manager-maintained templates without version history

Any `PROJECT_MANAGE` user maintains global templates in place; applying clones the current definition.

**Benefits:** smallest initial model and fastest experimentation.

**Risks:** overly broad organization-wide authority; weak historical explainability; unsafe audit and rollback. This option is not recommended for an operational ERP.

## Recommended contract

### Ownership, visibility, and scope

- **Authoritative owner:** the Luminal Operations/System Owner owns policy, project-type vocabulary, publication, and seed approval. Engineering owns implementation mechanics only after approval.
- **Scope:** each template belongs to one approved `project_type`; add `GENERAL` only if cross-type reuse is approved. Never infer type from its name.
- **Visibility:** published active versions are readable in Admin Workspace by authenticated users allowed to create/manage projects. Drafts, archives, version history, and audit history are visible only to template managers. Staff Workspace has no management surface.
- **Permission:** introduce global Admin Workspace capability `PHASE_TEMPLATE_MANAGE`. `PROJECT_MANAGE`, project membership, and phase roles do not grant template maintenance. Applying a template also requires existing project-create authorization.

### Lifecycle and versioning

- Stable template identity; versions have `DRAFT`, `PUBLISHED`, or `ARCHIVED` lifecycle.
- First publication creates version 1. Published versions are immutable. Changes clone a selected version to a draft, then publishing increments the version atomically.
- Only one version is current. Archive removes it from new selection while preserving versions and provenance.
- Hard delete is prohibited after publication/application. The safe default is archive-only; an audited delete exception for an unused, never-published draft requires explicit approval.
- Apply clones the published version into project-owned rows and records template/version, actor, and timestamp. Editing or archiving never changes existing projects.

### Stage ordering, ownership, and deadlines

- Stage order is unique, contiguous, and starts at 1. A published template has at least one stage; normalized duplicate names are rejected. Reorder only in draft and validate atomically at publish.
- Initial dependencies are linear: stage 1 has no predecessor; each later stage follows the preceding stage. Arbitrary graphs remain out of scope.
- Default tasks are ordered within a stage and may carry `is_required`, `requires_review`, and a default project-role code. Templates never store a specific employee.
- At apply, role placeholders resolve to an active project member or remain visibly unassigned; the server must never select an unrelated employee or trust a template employee ID.
- Stage offsets are non-negative whole calendar days from project start; task offsets are from stage start. Null means no default deadline. A date beyond the project deadline causes validation failure. Business-day/holiday calendars are out of scope unless approved instead.

### Audit and seed ownership

- Append-only audit records template/version, action, server-derived actor employee ID and time, before/after summary or structured diff, plus a reason for publish/archive/restore.
- Application history records project, applied version, actor, timestamp, and clone result. Partial clone/project creation fails atomically.
- The Operations/System Owner supplies and approves the initial catalog: project types, Vietnamese stage/task text, order, role placeholders, reviews, and offsets. Seeds are versioned repository data in an approved migration, not engineering guesses or silent UI constants. An empty launch catalog must also be explicit.

## Migration, RPC, and RLS implications

An approved package likely needs stable template, immutable version, ordered stage, ordered default-task, application-provenance, and audit-history tables. Exact schema requires preflight; the old proposal remains non-executable.

Server-owned transactions are required for create draft, clone version, publish, archive, and apply. Apply must select one active published version, validate type and authorization, clone all stages/tasks, record provenance/audit, and commit or roll back as one unit. Actor/time are server-derived.

RLS should expose active published reads only to eligible authenticated Admin Workspace users, restrict draft/archive/history reads to `PHASE_TEMPLATE_MANAGE`, and expose no browser insert/update/delete policies. Privileged RPC execution remains server-only. Project clones retain existing project read boundaries.

Required artifacts: read-only pre-run, reviewed forward migration, validation, rollback, seed manifest, compatibility/backfill report, RLS threat model, RPC contract tests, and authorized/denied smoke fixtures. No draft belongs in `supabase/migrations/` before approval.

## Rollback and compatibility

- Existing projects and legacy presets remain unchanged; no automatic conversion/backfill occurs without a separately approved deterministic map.
- Launch with capability absent/false. Current project creation continues when template objects/seeds are unavailable.
- Rollback disables selection first and preserves project rows, provenance, and audit history; it never rewrites project phases/tasks.
- Drop schema only if validation proves zero applications/history. After application, use forward repair/archive rather than destructive rollback.
- Reapply, replace, merge, or upgrade of an existing project workflow is rejected and remains a separate future contract.
- Project-type or role-code changes require an explicit compatibility map and validation report.

## Exact decisions required from the business owner

1. Select Option A, B, or C; Option A is recommended.
2. Name the accountable owner and approve/reject dedicated `PHASE_TEMPLATE_MANAGE`.
3. Approve project-type scoping and the authoritative type list, including `GENERAL`.
4. Approve active-template viewers and whether non-manager project creators may apply.
5. Approve immutable published versions, clone-on-apply, and no effect on existing projects.
6. Approve contiguous linear stages and exclusion of arbitrary dependencies.
7. Approve role-placeholder ownership, allowed role codes, and unassigned fallback.
8. Approve calendar-day offset anchors and project-deadline rejection, or require a business calendar.
9. Approve archive-only retention and any unused-draft delete exception.
10. Approve audit fields, reason requirements, and retention period.
11. Supply/approve initial seeds or explicitly approve an empty catalog.
12. Approve no legacy backfill, reapply, or upgrade in release one.

## Exact next action

The business owner returns these twelve decisions and the seed catalog (or explicit empty-catalog decision). Engineering then prepares a formal specification and schema preflight for only the selected contract. Until approval, keep Phase Templates `BLOCKED_BY_BUSINESS_DECISION`, do not implement them, and do not begin SaaS UI foundation.
