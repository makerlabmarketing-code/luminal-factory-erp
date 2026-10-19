# E-011 project checklist handoff

## Production resolution — 2026-10-19

User approved the exact correction and Migration API delivery. Applied version
20261019024924_allow_project_created_activity_event; approved SQL hash unchanged.
Postflight validated all ten event values. A rollback-only Production RPC probe
created one project, phase and task and saved a structure template successfully.
After rollback, reads confirmed zero TEST E011 projects/templates remain. This is
live SQL contract evidence; authenticated UI, staff and two-session acceptance
remain pending. The migration file matches the observed ledger version.


## Resolved database blocker — authenticated creation regression

The continuation smoke after deployment found that the July Production activity
constraint rejects PROJECT_CREATED, emitted by create_project_atomic. The entire
creation rolls back; no test project/template was persisted. Production readiness
must not be described as completed business acceptance. The local fixture had
omitted the real constraint and has now been corrected to reproduce this failure.

The minimal correction is prepared in supabase/drafts/project-checklist-activity:
add PROJECT_CREATED while preserving all nine existing event types, with guarded
forward SQL, read-only validation and data-preserving rollback. This correction required separate approval from the function package. The
user supplied that approval on 2026-10-19; see the resolution above.

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

## Production delivery — 2026-10-18

The user explicitly authorized Migration API delivery after the configured
GitHub Integration reported MIGRATIONS_FAILED and did not apply PR #231.
The approved SQL was applied byte-for-byte through apply_migration; the API
recorded version 20261018152856 (project_checklist_atomic). The repository
migration filename now matches this observed version to prevent replay.
SHA-256 remains 13e50bdb351004fe4436ed998fe5755dd24c92a1e9b964eafd418919eb7cf259.

Postflight confirmed all three functions exist. Staff RPC is SECURITY INVOKER,
service_role-only; anon/authenticated cannot execute. Template RPC has an empty
search_path, denies anon, allows authenticated/service_role while retaining its
session/workspace/permission checks. create_project_atomic retains its authenticated
boundary. No backfill, employee grants or operational fixture data was created
by the migration.

Both PROJECT_WORKFLOW_ATOMIC_CREATE_ENABLED and PHASE_TEMPLATES_ENABLED were
enabled for Production after postflight. The feature commit is 5899ad2b.
Production deployment and authenticated smoke evidence are recorded in the shared
coordination sheet; do not infer authenticated acceptance from build readiness.

Authenticated acceptance includes creation with inherited and overridden stage
assignments, saving/selecting a structure-only template, assigned staff transitions,
manager approval, unrelated employee denial and stale updates across two sessions.

## Validation

On 2026-10-18, after merge: 969 Vitest tests, lint, TypeScript, production build
with public build-only Supabase placeholders and diff check passed. The prior
isolated PostgreSQL suite passed before merge; it was not rerun in this session.
Live database postflight passed as described above.

Rollback: disable both flags, deploy the prior application, then use the reviewed
rollback.sql. It restores the prior project function and removes the two new
helpers, preserving projects, tasks, templates and history. Code revert does not
remove operational data. GitHub Integration still needs separate repair; do not
reset or replay its migration history blindly.
