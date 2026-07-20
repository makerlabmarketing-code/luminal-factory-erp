# Task Assignment Foundation Handoff

Date: 2026-07-20

## Current legacy task schema

The current task surface still carries legacy text fields such as project name, assigned-to text, packer assigned text, current phase text, estimation date, issue note, and status. Assignment is not yet normalized to stable employee identifiers in all task paths.

## Target task schema

Task Assignment Foundation should introduce or standardize:

- `project_id` required FK to `projects(id)`
- `phase_id` required when the task belongs to a phase
- `assignee_employee_id` FK to `employees(id)`
- optional reviewer/packer employee identifiers as separate stable fields if required by production workflow
- task assignment history table if reassignment audit is required

## Membership dependency

Before assigning a task, the server should validate that `assignee_employee_id` has an `ACTIVE` membership in the same `project_id`. Revoked membership rows must remain historical evidence and must not grant new assignment authority.

## Expected API

- `GET /api/admin/projects/:projectId/tasks`
- `POST /api/admin/projects/:projectId/tasks`
- `PATCH /api/admin/projects/:projectId/tasks/:taskId`
- `POST /api/admin/projects/:projectId/tasks/:taskId/assign`
- `POST /api/admin/projects/:projectId/tasks/:taskId/status`

Every mutation must use central project membership authorization and must block cross-project task IDs.

## Expected UI

Project Detail task forms should lazy-load active project members only when opening add/edit/assign dialogs. The task table should display employee names from server DTOs, not from legacy text matching.

The add/edit child-task UI is intentionally deferred to Phase 2 and should cover:

- child task name and description
- assignee selection from ACTIVE project members
- deadline input and validation
- comment capture for context or revision notes
- activity entry emitted by server mutation
- notification trigger design for assignee/reviewer changes

## Migration package required

A future migration package needs:

- forward SQL
- rollback SQL
- validation SQL
- backfill plan from legacy task text
- conflict report for names that cannot map to a stable employee ID
- production approval before any mutation

## Live blocker

LIVE_APPROVAL_REQUIRED for any migration, db push, backfill, task reassignment, or live data update. This branch intentionally does not run SQL and does not normalize task assignment storage.

## 2026-07-20 application-only preparation

Prepared but not enabled:

- shared Task Assignment DTOs and repository contract for project tasks, assignee member options, comments, activity and notification status;
- validation helpers for create/update/assign/status payloads, unknown-field rejection and deadline parsing;
- server API route contracts for list/create/update/assign/status under `/api/admin/projects/:projectId/tasks`;
- server migration gate using `TASK_ASSIGNMENT_FOUNDATION_ENABLED`; default is disabled until approved schema rollout and validation PASS;
- draft forward, rollback, validation SQL and backfill strategy under `supabase/drafts/20260720_task_assignment_foundation_*`.

No SQL was executed. No task rows were reassigned. No live data was mutated. Phase 2 remains blocked at `LIVE_APPROVAL_REQUIRED` until the migration package and backfill strategy are approved.

## 2026-07-20 live migration, repair, and repository wiring

Completed with live approval through the Supabase Management API over HTTPS:

- Applied the reviewed Task Assignment Foundation forward migration.
- Backfilled deterministic normalized fields only.
- Removed obsolete trial legacy task rows `1` and `2` after destructive repair approval and dependency inspection.
- Re-ran the complete Task Assignment validation package: schema, constraints, indexes, helper functions, RLS, read policies, browser-write-policy absence, FK/orphan checks, hierarchy checks, membership checks, and incomplete-backfill indicators all passed.
- Wired server Task Assignment persistence for list, create, update, assign, and status operations.
- Preserved the `TASK_ASSIGNMENT_FOUNDATION_ENABLED` migration gate so real persistence is enabled only by deployment/runtime configuration after validation.
- Preserved fake-success protection: API mutations return success only after Supabase persistence, comment/activity/notification side effects, and task reload succeed.

Rollback note: do not roll back the successful schema migration automatically. Rollback remains the reviewed SQL artifact and requires separate approval because live schema/data has changed.

## 2026-07-20 Phase 3 project workflow start

Phase 3 began with the project create reliability seam after Task Assignment validation passed.

- Duplicate project names are allowed when the business process creates another project under the same display name.
- Stable `projects.id` remains the project identity; the current schema has no separate project-code column to enforce.
- The admin project workflow view now groups and selects records by stable project key instead of display name so duplicate names do not merge visually.
- Project creation still returns success only after the project insert and phase creation attempt finish; stale duplicate-name errors are no longer shown.
- Global toast and confirmation overlays use the root portal layer with `z-index: 999999`.

## 2026-07-20 end-to-end project detail workflow

Completed application wiring for normalized project subtasks after the Task Assignment Foundation migration gate:

- Project Detail now loads normalized `/api/admin/projects/:projectId/tasks` once with the existing project members request and renders child tasks by stable `phaseId` when available. Legacy task rows remain read-only fallback while the runtime gate is unavailable.
- Each normalized subtask shows task name, assigned employee, deadline, Vietnamese status label, derived progress percentage, and comment count.
- Project users with `canManageTasks` may open an edit dialog to change assignee, deadline, status, and add a textarea comment through the existing assign/update/status APIs; the UI reloads from the server after save so data persists after refresh.
- The edit form reuses already-loaded ACTIVE project members instead of fetching a separate employee list.
- Staff or project members without task-management capability only receive assigned tasks from the server list path and see project detail task controls as read-only.

Remaining gaps:

- The current role matrix still grants task management only through global project management, Project Owner, and Project Manager. Creative Lead task-management remains unavailable unless the approved role matrix is changed later.
- Comment display currently uses comment count from the foundation API; latest-comment preview can be added after the API returns sanitized latest comment body.
- Sequential phase lock/complete/unlock mutations remain Phase 3 work and still require the workflow state-machine design.

Next Phase 3 slice: project detail phase gating/status transition design. Stop at `LIVE_APPROVAL_REQUIRED` if schema, RLS, or data mutation beyond approved application behavior is needed.

