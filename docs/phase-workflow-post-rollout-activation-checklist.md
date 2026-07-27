# Task Assignment and Phase Workflow Post-Rollout Activation Checklist

Date: 2026-07-27
Status: `MIGRATION_PROMOTED_PENDING_PROTECTED_MAIN_MERGE`

## Before rollout

- [ ] Run the authoritative Phase Workflow pre-run read-only report and record numeric row counts.
- [ ] Confirm zero orphan phases, duplicate `(project_id, order_index)` positions, and unknown statuses.
- [ ] Confirm the Task Assignment validation suite remains PASS and `TASK_ASSIGNMENT_FOUNDATION_ENABLED` retains its currently approved runtime value.
- [ ] Confirm no production operator will run both direct SQL and GitHub Integration delivery.
- [x] Confirm the already-applied `create_project_atomic(jsonb)` package and its phase/task/member dependencies are not duplicated in the Phase Workflow migration.
- [x] Promote only the reviewed Phase Status/Dependency executable SQL as `supabase/migrations/20260727044729_phase_status_dependency.sql`.

## GitHub delivery gate

- [ ] Review and merge the PR through protected `main`; do not push or merge directly.
- [ ] Watch the Supabase GitHub Integration check for the production deployment and require PASS before validation or runtime activation.
- [ ] Confirm migration version `20260727044729` is recorded exactly once; do not run the draft manually and do not use `db push`.

## After migration delivery

- [ ] Run `supabase/drafts/20260721_phase_status_dependency_validation.sql`; every boolean check must be `true`.
- [ ] Confirm phase row count equals the pre-run count.
- [ ] Confirm initial history count equals the pre-run history count (normally zero for first creation).
- [ ] Confirm `anon` and `authenticated` cannot execute `transition_project_phase_status`.
- [ ] Confirm authenticated project viewers can read only history for projects visible through `can_view_project`.
- [ ] Set `PHASE_WORKFLOW_FOUNDATION_ENABLED=true` on the server runtime only after validation PASS.
- [ ] Verify Project Detail reloads persisted phase states and no longer shows the compatibility warning.
- [ ] Set `PHASE_STATUS_MUTATION_ENABLED=true` only after the status RPC smoke test passes in a non-production verification project.
- [ ] Activate the phase-transition UI in a separate application delivery; until then controls remain intentionally disabled and labeled `READY_FOR_UI_ACTIVATION`.

## Live verification

- [ ] Complete an eligible phase and confirm one phase row changes plus exactly one history row is inserted.
- [ ] Attempt a stale `expectedCurrentStatus` transition and confirm it is rejected without a history row.
- [ ] Attempt to unlock a phase whose predecessor is incomplete and confirm server rejection.
- [ ] Verify Project Detail members, task assignees, deadlines, comments/activity, loading, error, and empty states still render.
- [ ] Verify Staff Portal attendance loads and performs no project/member/phase request; do not mutate an attendance row during this checklist.

## Rollback readiness

- [ ] Disable `PHASE_STATUS_MUTATION_ENABLED` and `PHASE_WORKFLOW_FOUNDATION_ENABLED` before rollback.
- [ ] Export `phase_status_history` before destructive rollback if it contains any row.
- [ ] Obtain separate destructive approval for rollback.
