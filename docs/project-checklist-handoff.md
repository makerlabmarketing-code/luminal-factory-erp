# E-011 project checklist handoff

## Approved behavior

The user approved a checklist-first project flow and requested continuation.
Project creators choose the built-in artisan recipe, an empty structure, or a
published template. Ordinary creation needs project information and a manager;
colorway is optional. Stages inherit the manager and computed deadline, with
optional stage overrides and collapsed task exceptions. Overrides remain attached
when removing tasks or moving stages. The optional save-as-template checkbox
requires PHASE_TEMPLATE_MANAGE and the template flag; no permissions are granted.

Published snapshots use the existing immutable template version contract. They
copy names, required/review flags and order only, resetting assignment to the new
PROJECT_MANAGER role and omitting real dates, notes, results and history. A saved
published template is applied atomically; stage assignment overrides during that
application remain outside this slice. New projects do not track later edits.

Staff see canonical statuses and contextual actions. Normal progress notes are
optional; a blocked task requires a reason. Staff cannot approve their own work.
Status, optional note and optional deadline update commit together. The client
holds a synchronous submit lock; the database rejects stale status updates.
Unedited dates are omitted, avoiding overwriting a manager's changed deadline.

Project creation and optional template publication are separate operations: if
publication fails, the created project stays visible and is never recreated by
an automatic retry. The warning links to that project. Existing projects and
legacy tasks are not backfilled or converted.

## Deployment gate

SQL package approved by the user on 2026-10-16 (“tiếp tục đi”) in response to
the exact package approval request. Approved forward SQL is promoted byte-for-byte
to supabase/migrations/20261016062344_project_checklist_atomic.sql. Production
application and database verification are pending. Read-only inspection confirmed the existing project RPC
and template management RPC; no published templates exist. Project workflow and
phase template environment flags are currently unset. Draft SQL lives under
supabase/drafts/project-checklist, outside automatic migration delivery.

Approval and promotion are complete; review the PR and use the configured
Supabase GitHub integration. Do not deploy this app ahead of the staff RPC: staff updates depend
on it. After migration validation, enable PROJECT_WORKFLOW_ATOMIC_CREATE_ENABLED
and PHASE_TEMPLATES_ENABLED with the intended deployment and existing grants.

Read-only postflight is validation.sql. Authenticated smoke still pending:
create a designated disposable project; inherit and override assignments; save
and select a template; verify no old people/dates/results; start/submit/block as
assigned staff; approve via existing manager flow; deny an unrelated employee.
Use two sessions to confirm stale updates. No live fixture has been created.

## Validation

969 Vitest tests passed. Isolated PGlite PostgreSQL tests pass for create/task
links, snapshot/apply, stale transition and role guards, failure rollback for
comments and publication, guarded forward SQL and data-preserving rollback.
PGlite fixtures stub auth/permissions and do not establish live RLS evidence.
Lint, TypeScript, production build and git diff --check passed. Build used public
build-only Supabase placeholders; no credentials were required.
React review covered server authorization, stable stage identity, labelled
controls, collapsed optional inputs, and event-driven writes.

Rollback: disable both flags, deploy the prior application, then use the reviewed
rollback.sql. It restores the prior project function and removes the two new
helpers, preserving projects, tasks, templates and history. Ordinary code revert
alone does not undo template/project data already created.
