# Phase Workflow Foundation Backfill Report Draft

Do not run data changes from this document. This is the review checklist for the approved rollout window.

## Inputs To Inspect

- `public.phases.id`
- `public.phases.project_id`
- `public.phases.name`
- `public.phases.order_index`
- `public.phases.created_at`
- `public.projects.status`

## Blocking Conditions

- Duplicate `(project_id, order_index)` rows.
- Phase rows whose `project_id` does not exist in `public.projects`.
- Any project where order cannot be determined by `(order_index, id)`.
- Any live phase row already carrying unexpected workflow status after migration.

If any blocking condition exists, stop and produce a manual review list. Do not infer completion.

## Proposed Backfill Rules

- `description`: leave `null`.
- `assignee_employee_id`: leave `null`.
- `deadline`: leave `null`.
- `started_at`: leave `null` unless a reviewed operational source exists.
- `completed_at`: leave `null`; do not infer completed phases from order alone.
- `updated_at`: set to migration time only as the technical concurrency baseline.
- `updated_by_employee_id`: leave `null` for migration-created baseline.
- `status`:
  - If project is `CANCELLED`, set all phases to `CANCELLED` only after confirming business wants phase-level cancellation mirrored from project status.
  - Otherwise, set the smallest ordered phase per project to `IN_PROGRESS` only if the project is active and business approves automatic opening.
  - Set later phases to `NOT_STARTED`.

Conservative alternative: set all existing phases to `NOT_STARTED`, and let the first transition API open the current phase. This avoids false active/completed state.

## Validation After Backfill

- No duplicate `(project_id, order_index)`.
- No orphan `project_id`.
- No invalid `status`.
- `COMPLETED` rows have `completed_at`.
- Every non-null assignee is an active employee and active project member.
