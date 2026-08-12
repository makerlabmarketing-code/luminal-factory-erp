# Project Membership Current State Audit

Date: 2026-07-20
Branch: `feat/project-membership-completion`

## Attendance boundary

Attendance remains outside Project Membership authority. The Staff Attendance API and Staff Portal use authenticated account resolution, an ACTIVE employee, `STAFF_WORKSPACE`, and valid attendance state only. They do not query `project_members`, projects, phases, or tasks, and they do not require `PROJECT_VIEW` or `PROJECT_MANAGE`.

Shift calculation remains unchanged: `> 0` to `3` hours = 1 shift, `> 3` to `6` hours = 2 shifts, and `> 6` hours = 3 shifts.

Manual live verification checklist:

- Sign in as a STAFF_WORKSPACE account with an ACTIVE employee.
- Open Staff Portal attendance.
- Confirm no project, phase, task, or project member request is needed for initial load.
- Check in and check out in a non-production verification environment only.
- Confirm no STAFF_WORKSPACE grant was created by this branch.

Attendance application boundary = COMPLETE.

## Schema authority

Local approved migration authority: `supabase/migrations/20260714045636_project_members_foundation.sql`.

`public.project_members` columns:

- `id`
- `project_id` FK to `public.projects(id)` with `on delete restrict`
- `employee_id` FK to `public.employees(id)` with `on delete restrict`
- `role_code`
- `status`
- `granted_at`
- `granted_by_employee_id` FK to `public.employees(id)`
- `revoked_at`
- `revoked_by_employee_id` FK to `public.employees(id)`
- `created_at`
- `updated_at`

Role authority:

- `PROJECT_OWNER`
- `PROJECT_MANAGER`
- `CREATIVE_LEAD`
- `CONTRIBUTOR`

Status authority:

- `ACTIVE`
- `REVOKED`

Constraints and indexes:

- role whitelist check
- status whitelist check
- revocation-state check
- grant-before-revoke check
- unique ACTIVE same-role row via `project_members_one_active_role`; this does
  not enforce one ACTIVE role per Employee/project regardless of role code
- project, employee, status, and project/status indexes

## Runtime authority

- Actor identity is resolved server-side from Supabase auth session to an ACTIVE employee.
- Workspace permissions live in `employee_workspace_access` and `employee_permissions`.
- `ADMIN_WORKSPACE` + `PROJECT_MANAGE` is the explicit global override.
- Project and phase mutation routes already use server boundaries; role logic had been split between project and phase helpers.

## Gaps closed in this branch

- Add a central project membership capability helper.
- Add server routes for list/add/change/revoke membership.
- Expose member DTO and server-derived capabilities to Project Detail behavior.
- Add Project Detail membership UI using server capability DTO only.
- Add regression tests for authorization matrix, API route contracts, UI lazy loading, and attendance separation.

## Live schema limitation

No live SQL was run. If cloud cannot read live schema during review, use the approved migration and previous drift reports as temporary authority, then run read-only live verification after explicit approval.

## 2026-08-05 — Slice 0 baseline from protected main

Branch: `codex/project-membership-baseline`

The repository audit confirms that `public.project_members` is the authoritative
project-membership relation. Authorization identifiers are `projects.id` and
`employees.id`; display names, email addresses, and Auth user IDs are presentation
or account-link fields only. Membership scope is project-specific. Workspace access
and permission rows provide global Admin overrides, while an ACTIVE membership
provides project-scoped access.

### Authority matrix

| Question | Repository authority |
|---|---|
| What makes an Employee a member? | An ACTIVE `project_members` row keyed by `project_id` + `employee_id`. REVOKED rows are historical. |
| Where is the owner stored? | On `project_members` as `role_code = PROJECT_OWNER`; `projects` has no owner column in the approved membership migration. Basic compatibility create currently creates only the selected `PROJECT_MANAGER`; atomic create authority creates the actor as owner. |
| Multiple project roles? | The application authorization model expects one ACTIVE role per Employee/project. The current database unique index includes `role_code`, so it does not independently enforce that invariant. |
| Project Manager / Creative Lead scope? | Membership role codes are project-specific. Account preset codes and permissions are global account configuration and must not replace membership checks. |
| Membership scope? | Project-specific, with global `ADMIN_WORKSPACE` + project permission overrides. No facility or organization key exists on `project_members`. |
| Inactive historical members? | Foreign keys use `ON DELETE RESTRICT`; inactive or revoked employees can remain historical. Active authorization still requires an active authenticated Employee. |
| Remove a member with active tasks? | Revoke currently does not inspect or unassign active task rows. New normalized assignment validation rejects revoked/non-member assignees, but existing dependency behavior needs a later decision. |
| Must assignees be members? | Normalized Task Assignment server validation requires an eligible ACTIVE project member. Legacy text assignment paths are not equivalent authority. |
| Admin visibility/mutation? | Admin access is server-derived. `ADMIN_WORKSPACE` + `PROJECT_VIEW` gives global view; `PROJECT_MANAGE` gives global mutation. System Owner legacy Admin access is handled by the auth boundary. |
| Staff visibility? | The normalized project/task server boundary is membership-aware, but the existing Staff task page still uses the legacy global workflow loader and client-side assignment matching. This is a confirmed follow-up visibility gap. |
| Project Manager / Creative Lead membership mutation? | ACTIVE project `PROJECT_OWNER` and `PROJECT_MANAGER` can manage members; `CREATIVE_LEAD` and `CONTRIBUTOR` are view-only at this boundary. Server checks are authoritative. |
| Duplicate rows? | Service checks reject duplicate ACTIVE membership, and the database prevents duplicate same-role ACTIVE rows. A database invariant for one ACTIVE employee/project regardless role is still missing. |
| Removal behavior? | Soft revoke only; hard delete is not exposed by the service or RLS grant. |
| Audit trail? | Membership rows retain grant/revoke actor and timestamps. No reason, correlation ID, before/after event row, or dedicated membership audit event is present. |

### Slice 0 findings

- Project creation has two paths. The gated atomic path is the only path that can
  create project, owner, members, phases, tasks, activity, and notifications in one
  transaction. The default compatibility path inserts `projects` and then inserts
  the selected manager membership separately; a membership failure is returned as
  a warning after the project has already been created. This is a known partial-write
  boundary, not a safe candidate for a client-only repair.
- Membership role change is a revoke followed by a new insert. If the second write
  fails, the prior active role has already been revoked. An atomic server RPC is
  required before hardening this mutation.
- The current `project_members_one_active_role` index is unique on
  `(project_id, employee_id, role_code) WHERE status = 'ACTIVE'`. This matches the
  same-role duplicate rule but does not enforce the application invariant of one
  active role per Employee/project.
- Membership mutations do not write `project_activity` or a dedicated audit table.
  Existing grant/revoke columns are useful provenance but do not provide a complete
  before/after audit record.
- The normalized Admin Project Detail task path restricts non-task-managers to tasks
  assigned to the authenticated Employee and validates active project membership.
  The legacy Staff workflow path still loads project/task data through the global
  workflow repository and relies on client-side name/ID matching, so it can expose
  more project/task context than the Staff assignment contract permits and still
  contains legacy mutation calls. This must be corrected in a bounded Staff/task
  visibility slice, not by redesigning Project Detail here.
- The repository contains both a tracked compatibility path and draft/live-history
  references for `projects.project_code`. Production presence, uniqueness, and RPC
  privilege state remain unverified in this slice.

### Safe Slice 0 fixes

- Project creation employee options are cached across dialog opens and concurrent
  option requests share one promise.
- Project create submission uses a synchronous ref lock in addition to React state.
- Project membership candidate loading shares one in-flight request, and add/change-
  role/revoke mutations use a synchronous action lock to prevent duplicate requests.

No Attendance code, migration, RLS policy, RPC, production query, runtime flag, or
live project/membership row was changed.

### Next slices

- **Slice 1 — membership read model and Project Detail display:** reconcile the
  member DTO, owner/manager representation, project-code authority, and targeted
  refresh behavior without redesigning the page.
- **Slice 2 — add/remove/change-role mutations:** only after the atomic mutation
  contract and owner/role semantics are approved; include audit events and active
  task dependency behavior.
- **Slice 3 — task/subtask membership enforcement:** replace the legacy Staff task
  loader with a server-owned, assignment-scoped read/write boundary and preserve
  Staff-to-Admin separation.
- **Slice 4 — audit, performance, and completion hardening:** complete mutation
  audit, request timelines, duplicate/integrity checks, and operator verification.

The read-only operator package is
`supabase/validation/20260805_project_membership_baseline_readonly.sql`.

## 2026-08-12 — Slice 2 atomic mutation package

Status: **READY_FOR_OPERATOR; runtime disabled**.

- Add, role change, and revoke now share `mutate_project_membership(...)` instead
  of separate browser-visible writes.
- The transaction locks the project and target membership, revalidates the
  server-derived actor, rejects cancelled projects, enforces one ACTIVE role per
  Employee/project, and protects the final active owner.
- Revoke rejects an Employee who still owns a task outside `COMPLETED` or
  `CANCELLED`; work must be transferred or completed first.
- Every accepted mutation requires a 10–500 character reason and writes immutable
  before/after state, actor, timestamp, operation, and correlation ID.
- Browser roles no longer receive INSERT/UPDATE/DELETE or RPC EXECUTE authority.
  The privileged server client is the only caller and the RPC rechecks authority.
- `PROJECT_MEMBERSHIP_ATOMIC_MUTATIONS_ENABLED` defaults closed. Authorized users
  retain the read model while mutation controls explain the pending activation.
- No SQL or live row mutation was executed from Codex Cloud.

Delivery artifacts:

- `supabase/migrations/20260812090000_project_membership_atomic_mutations.sql`
- `supabase/validation/20260812090000_project_membership_atomic_mutations_validation.sql`
- `supabase/rollbacks/20260812090000_project_membership_atomic_mutations_rollback.sql`
- `docs/project-membership-atomic-mutations-handoff.md`

The next application slice is Slice 3, the Staff task/subtask membership boundary.
Slice 4 then completes audit pagination, integrity/timeline hardening, and operator
verification for this workstream.

## 2026-08-12 — Slice 3 verification and Slice 4 completion

Slice 3 was already delivered by PR #138 (`1cea808`) and remains present on
protected `main`: Staff task reads are assignment-scoped, require ACTIVE project
membership, exclude cancelled projects, batch-load project/phase data, and recheck
assignment plus membership on PATCH. No duplicate implementation was added.

Slice 4 repository work is now complete:

- a manager-only, no-store audit endpoint requires authenticated project mutation
  authority before checking the runtime gate;
- audit reads use descending ID cursor pagination with a maximum of 50 rows;
- actor and target Employee names are batch loaded without per-row queries;
- integrity summary reports active owners, duplicate ACTIVE Employee memberships,
  and active tasks whose assignee is no longer an ACTIVE member;
- Project Detail lazy-loads audit only when expanded, preserves loaded events after
  a failed refresh, blocks duplicate requests synchronously, and exposes the full
  correlation ID for support;
- audit and integrity errors remain sanitized; no raw database row or error is
  returned to the browser;
- the operator migration, validation, rollback, fixture, and flag order remains in
  `docs/project-membership-atomic-mutations-handoff.md`.

Project Membership Slices 0–4 are complete at repository level. Production
activation remains `READY_FOR_OPERATOR`; no SQL or runtime flag was applied here.
