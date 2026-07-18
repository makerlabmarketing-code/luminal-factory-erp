# Phase Workflow Foundation Final Threat Model

Date: 2026-07-18

Status: draft only.

## Assets

- Phase status.
- Phase assignment.
- Phase deadline.
- Start/completion timestamps.
- Optimistic concurrency token.
- Project membership and project read authority.

## Trust Boundaries

- Browser can read phases through RLS.
- Browser must not directly insert, update, or delete phases.
- Phase mutation remains behind the approved server boundary.
- Server derives actor employee identity from authenticated session.
- Browser payload must not be authority for role, permission, actor, `updated_at`, `started_at`, or `completed_at`.

## Controls In Foundation

- `public.phases` RLS is enabled.
- Only SELECT policy is created: `phases project access select`.
- SELECT policy delegates to `public.can_view_project(project_id)`.
- No anon policy.
- No policy ALL.
- No browser INSERT/UPDATE/DELETE policy.
- `updated_at` is maintained by a database trigger.
- Assignee FK uses stable `employees.id`.
- Server must validate active project membership before assigning an employee.

## Deferred Controls

- Explicit dependency graph or `phase_dependencies` table.
- Activity log.
- Comments.
- Notification fanout.
- Review/approval records.
- Phase templates.
- Task assignment schema.
- Colorway/stage schema.

## Residual Risks

- `updated_by_employee_id` may be null when a privileged server client mutates without session context. The server boundary must set the trusted actor employee id when available.
- Existing broad table grants on legacy workflow tables must be rechecked during validation; RLS policies remain the enforcement boundary.
- The first active phase is not inferred. A user-visible transition is required to move a phase to `IN_PROGRESS`.
