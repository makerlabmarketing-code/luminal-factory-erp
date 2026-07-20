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
