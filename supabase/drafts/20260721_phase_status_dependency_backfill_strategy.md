# Phase Status/Dependency Backfill Strategy

DRAFT ONLY. Do not execute without explicit approval.

## Scope

Prepare deterministic compatibility classification for existing `public.phases` rows before enabling phase status/dependency mutations.

## Read-only pre-run report

Before any mutation, report:

- Total phase rows.
- Phase rows with null `project_id`.
- Phase rows whose `project_id` has no matching `public.projects.id`.
- Duplicate `order_index` rows within the same project.
- Existing distinct `status` values, including null.
- Rows with `completed_at` populated.
- Projects with no phases.
- Projects whose first phase is not `order_index = 0`.

## Deterministic mapping rules

Only map rows that pass preconditions:

1. Existing `status` in `ACTIVE`, `LOCKED`, `COMPLETED`, `BLOCKED`, `REVIEW`, `CANCELLED` stays unchanged.
2. Null `status` with non-null `completed_at` maps to `COMPLETED`.
3. Null `status` with `order_index = 0` maps to `ACTIVE`.
4. Null `status` with `order_index > 0` maps to `LOCKED`.
5. Any unrecognized non-null `status` is a blocker and must be classified before mutation.
6. Do not infer completion from phase name, project name, task text, display labels, or user-entered notes.

## Blockers

Stop before mutation when any of the following are found:

- Orphan phase rows.
- Duplicate `order_index` within a project.
- Unrecognized non-null phase status.
- Completed phase without reliable completion evidence when it would affect dependencies.
- Any requirement to modify task rows, membership rows, employee rows, Auth users, attendance, payroll, or finance records.

## Rollback compatibility

Rollback should preserve `phases.status`, `completed_at`, `updated_at`, and `updated_by_employee_id` by default to avoid data loss. Dropping those columns requires a separate destructive approval after export and downstream verification.
