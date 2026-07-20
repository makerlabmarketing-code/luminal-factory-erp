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
- unique ACTIVE membership authority via `project_members_one_active_role`
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
