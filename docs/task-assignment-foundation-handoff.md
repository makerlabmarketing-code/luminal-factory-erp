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



## 2026-07-20 Phase 3 project phase workflow application slice

Completed application-only workflow state-machine preparation:

- Added a central pure phase workflow helper for task status transitions, phase gating, phase progress and project progress calculations.
- Project Detail now filters status options through the approved task transition map before sending status mutations.
- Project progress now averages phase progress derived from task progress, instead of only counting completed phases.
- Phase detail now shows gate messaging and latest normalized task activity timestamp when available.
- Creative Lead permissions were not expanded; task and phase controls still rely on the existing server capability DTO and current role matrix.

No SQL was executed. No schema, RLS, role matrix, or live data mutation was added. Completing/unlocking phases remains blocked until an approved phase status/dependency mutation contract and persistence plan exist.

Next Phase 3 slice: prepare the phase status/dependency mutation design, migration/rollback/validation SQL, RLS impact and audit-history plan, then stop at `LIVE_APPROVAL_REQUIRED` before any live schema or data mutation.

## 2026-07-21 Phase 3 phase status/dependency mutation design

Prepared but did not run the next Phase 3 persistence package:

- Documented the active Phase 3 slice, acceptance criteria, exit criteria, server mutation contract, status model, transition matrix, database impact, RLS impact, audit-history requirements, and compatibility plan in `docs/phase-status-dependency-mutation-design.md`.
- Added draft-only forward, rollback, and validation SQL artifacts under `supabase/drafts/20260721_phase_status_dependency_*`.
- Kept browser writes out of scope; phase status mutation remains planned for server route + existing phase authorization boundary.
- Preserved the current role matrix: `CREATIVE_LEAD` remains view-only unless an approved role change is made later.

No SQL was executed. No schema, RLS, role matrix, deployment, or live data mutation was performed. The next step is `LIVE_APPROVAL_REQUIRED` for review/approval before any phase status/dependency migration, RLS change, backfill, or production data mutation.

## 2026-07-21 Phase 4 project detail loading-state polish

Continued from the latest main branch after the gated Phase 3 persistence planning/application work reached `LIVE_APPROVAL_REQUIRED`.

Completed an application-only UI polish slice:

- Added a Project Detail route-level loading skeleton for Next.js route transitions.
- Replaced the Project Detail client refresh loading state with a layout-matching skeleton that preserves the header, KPI, workflow/member, and sidebar structure while data is loading.
- Added static regression coverage for the route loading file and inline loading accessibility markers.

No SQL was executed. No schema, RLS, backfill, RPC, feature flag, deployment, or live data mutation was performed. Phase 3 phase status/dependency persistence remains blocked at `LIVE_APPROVAL_REQUIRED` until explicit live approval is granted.

## 2026-07-21 Review debt remediation sweep

Completed application-only remediation for actionable task-assignment review debt that was still present on the current branch:

- Task employee embeds now disambiguate the `tasks.assignee_employee_id -> employees.id` foreign key in task list/load selects.
- Assignment validation now distinguishes omitted `assigneeEmployeeId` from explicit `null` so malformed assignment payloads cannot silently clear the assignee.
- Assignee eligibility now requires ACTIVE project membership and an eligible employee row that is not inactive, locked, disabled, deleted, or `is_active = false`.
- Parent task changes now reject self-parenting and direct or indirect cycles while loading ancestors inside the same project boundary.
- Status changes now load the persisted status and validate the requested transition through the canonical task transition map before writing.
- Empty task updates now fail before writing audit fields or emitting `TASK_UPDATED` activity.
- Task creation no longer performs a non-atomic partial-write sequence. The current application path stops with `task_assignment_atomic_create_required` until the reviewed transactional RPC is approved and deployed.
- Draft-only RPC artifact prepared at `supabase/drafts/20260721_task_assignment_atomic_create_rpc.sql`; no SQL, migration, RLS, grant, backfill, or live data mutation was run.

Current gate: `LIVE_APPROVAL_REQUIRED` before creating/deploying the atomic task-create RPC or granting execute access.

### 2026-07-21 inline review follow-up

Resolved follow-up review comments from the remediation PR:

- Unchanged task PATCH/assign/status calls are now idempotent and do not write audit fields or emit update/status/assignment activity for no-op saves.
- Project Detail task status options now use the same shared task transition source as the server validator.
- Project member DTOs now expose assignability based on ACTIVE membership plus employee eligibility, and Project Detail filters assignee options by that flag.

No SQL, migration, RLS, grant, backfill, RPC execution, or live data mutation was run.

## 2026-07-21 Phase 4 project detail empty/error state polish

Continued Phase 4 with an application-only shared state-pattern slice while Phase 3 persistence and the task-create RPC remain at `LIVE_APPROVAL_REQUIRED`.

- Added a reusable `OperationalState` presentation component for Project Detail empty and error states.
- Replaced the Project Detail load failure panel, no-phase state, no-member state, and selected-phase no-task state with the shared pattern.
- Preserved server authorization, project/task business logic, feature gates, workflow transitions, and live data behavior.
- Added static regression coverage for the shared state component, Vietnamese copy, retry action, and Project Detail adoption.

No SQL was executed. No schema, RLS, backfill, RPC, feature flag enablement, deployment, or live data mutation was performed.

Current gate: `LIVE_APPROVAL_REQUIRED` before deploying the task-create RPC, grants, phase status/dependency schema/RLS, backfill, or any live mutation.

## 2026-07-21 dev-only visual monitoring workflow

Added documentation and dev scripts for local agent-session monitoring and UI screenshot evidence:

- `docs/agent-visual-monitoring.md` documents how to use Agent Eye or an equivalent local dashboard, how to capture screenshots, and how to attach evidence to PRs.
- `npm run agent:monitor` prints the local monitoring checklist without starting production, paid, or cloud-only services.
- `npm run ui:screenshot` and `npm run ui:verify` call a dev-only Node wrapper that assumes a local Next.js server by default and can start one with `-- --start-server`.
- Screenshot output goes under `.artifacts/screenshots/`, which is ignored by git.
- Playwright/Cypress were inspected and are not installed in `package.json`; no heavy browser dependency was added. The screenshot wrapper exits with a clear missing-tool or missing-browser message until local browser tooling is explicitly approved and installed.

No business logic, schema, RLS, backfill, RPC, feature flag, production deployment, or live data mutation was changed.


## 2026-07-21 Phase 4 phase template metadata persistence

Continued Phase 4 with an application-only Project Workflow Template foundation slice while Phase 3 phase status/dependency persistence and task-create RPC remain at `LIVE_APPROVAL_REQUIRED`.

Completed:

- Project creation now passes application-layer template metadata through the existing phase API: colorway name/code, stage type, owner, planned dates, progress, next action, and required-review flag.
- Server phase create persists only to existing `phases` columns after the existing phase authorization boundary passes.
- Phase list DTO and repository normalization return those metadata fields so Project Detail and project overview can reload the real persisted values after refresh instead of blank fallback metadata.
- Preset phase and task names shown/saved by the UI are Vietnamese.
- Added focused static regression coverage for UI → service → repository → API/server → Supabase phase metadata wiring.

No SQL was executed. No schema, RLS, backfill, RPC, grant, feature-flag enablement, deployment, destructive operation, or live data mutation was performed by this slice.

Current gate remains `LIVE_APPROVAL_REQUIRED` before deploying the task-create RPC, grants, phase status/dependency schema/RLS, backfill, or any live mutation.

## 2026-07-21 Phase 4 project detail responsive consistency

Continued Phase 4 with an application-only responsive/detail consistency slice while Phase 3 phase status/dependency persistence and task-create RPC remain at `LIVE_APPROVAL_REQUIRED`.

Completed:

- Project Detail now keeps the main/detail layout as one column through tablet widths and moves the summary sidebar to a sticky desktop rail only at the XL breakpoint.
- Selected phase metadata uses reusable field cards so deadline, owner, progress, and latest activity present consistently across responsive widths.
- Mobile task rendering now uses semantic task cards with `article`/`dl`, scan-level status, compact labels, and a full-width edit action for touch usability.
- Removed a duplicate `getTaskStatusValue` declaration while preserving the existing task status fallback behavior.

No SQL was executed. No schema, RLS, backfill, RPC, grant, feature-flag enablement, deployment, destructive operation, or live data mutation was performed by this slice.

Current gate remains `LIVE_APPROVAL_REQUIRED` before deploying the task-create RPC, grants, phase status/dependency schema/RLS, backfill, or any live mutation.

## 2026-07-21 Phase 4 project detail task action clarity

Continued Phase 4 with an application-only task edit action clarity slice while Phase 3 phase status/dependency persistence and task-create RPC remain at `LIVE_APPROVAL_REQUIRED`.

Completed:

- Added a pure task edit intent helper so Project Detail can describe whether assignee, deadline, or status will be updated before saving.
- Updated the task edit modal to show a Vietnamese live summary of pending changes and disable `Lưu` when there is no task field change.
- Kept a handler-level no-op guard so accidental no-change submissions do not call assignment, deadline, or status APIs.
- Added focused Vitest coverage for changed-field intent and no-op detection.

No SQL was executed. No schema, RLS, backfill, RPC, feature flag, deployment, or live data mutation was performed.

Current gate remains `LIVE_APPROVAL_REQUIRED` before deploying the task-create RPC, grants, phase status/dependency schema/RLS, backfill, or any live mutation.

## 2026-07-21 Corrective Slice 1 authorization and workspace semantics

Completed application-only corrective slice from the latest main-equivalent branch:

- Phase read authorization now separates read-only loading from mutation authorization. `ADMIN_WORKSPACE` with `PROJECT_VIEW` or `PROJECT_MANAGE` can load all project phases without ordinary project membership; mutation actions still require `PROJECT_MANAGE` or approved project roles.
- System Owner legacy protected access remains a global project/phase override and remains guarded by the existing last-administrator protection so ownership is not accidentally self-revoked through account permission changes.
- Project membership authorization now has an explicit read-only global capability for Application Admin project loading so `PROJECT_VIEW` does not imply edit/member/phase/task/cancel capabilities.
- Project workflow loading preserves already loaded project rows as sanitized placeholder workflow records if the phase request fails, including stable error code, failure stage, and Vietnamese message without raw database details.
- Account workspace UI now treats Staff Workspace and Admin Workspace as independent badges/actions from a single row actions menu. Revoking both workspaces revokes ERP access rows and permissions but does not delete the Supabase Auth account.

No SQL, migration, RLS change, permission backfill, Auth mutation, production deployment, or live data mutation was run.

Future corrective slices recorded but not implemented:

- Corrective Slice 2: create employee profile independently from Auth invitation; quick edit and full employee profile; salary, bank account, beneficiary QR, employment history; invite/connect account as a separate retryable operation.
- Corrective Slice 3: task assignee and deadline; finance beneficiary, payer, creator and reimbursement workflow; receipts and employee reimbursement requests.
