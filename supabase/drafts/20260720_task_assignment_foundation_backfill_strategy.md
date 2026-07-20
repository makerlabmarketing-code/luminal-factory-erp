# Task Assignment Foundation Backfill Strategy (Draft)

Date: 2026-07-20

Status: Draft only. Do not run without live approval.

## Source legacy fields

- `public.tasks.project_name` -> candidate project name match, not authoritative.
- `public.tasks.current_phase` -> candidate phase name/status text, not authoritative.
- `public.tasks.assigned_to` -> candidate assignee display name, not authoritative.
- `public.tasks.packer_assigned` -> candidate optional packer display name, not in Phase 2 execution unless approved.
- `public.tasks.estimation_date` -> candidate `deadline` after date parsing validation.
- `public.tasks.issue_note` -> candidate `description` or initial comment after review.

## Matching order

1. Map tasks to projects only when exactly one non-cancelled project has the same normalized name.
2. Map phases only inside the matched project and only when exactly one phase name matches.
3. Map assignees only when exactly one ACTIVE employee display name matches and that employee has ACTIVE membership in the matched project.
4. Leave ambiguous values null and emit conflict rows; do not guess.

## Conflict report columns

- `task_id`
- `legacy_project_name`
- `legacy_phase_text`
- `legacy_assigned_to`
- `candidate_project_count`
- `candidate_phase_count`
- `candidate_employee_count`
- `has_active_project_membership`
- `resolution_required`

## Comment, activity, and notification backfill

Do not infer comments, activity, or notifications automatically from legacy free-text fields. `issue_note` can become a task description or an initial comment only after manual review. Activity and notification rows should be emitted by future server mutations after the normalized task row exists; historical synthetic activity requires separate approval.

## Rollout sequence

1. Run read-only conflict report.
2. Review conflicts manually.
3. Apply approved schema migration.
4. Backfill only unambiguous project/phase/deadline/title fields.
5. Backfill assignee only after ACTIVE membership validation.
6. Validate task hierarchy, status values, project/task consistency, missing indexes, missing policies and absence of browser write policies.
7. Enable `TASK_ASSIGNMENT_FOUNDATION_ENABLED=true` only after validation PASS.

## Rollback notes

Rollback must not drop normalized columns while they contain production-only data unless an export or compatibility copy has been approved.
