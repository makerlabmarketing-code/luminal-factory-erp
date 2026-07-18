# Phase Workflow Foundation Final Backfill Report

Date: 2026-07-18

Status: draft only. No SQL has been run from this report.

## Current Decision

Use the conservative baseline:

- Existing phases get `status = NOT_STARTED`.
- Existing phases keep `description = null`.
- Existing phases keep `deadline = null`.
- Existing phases keep `assignee_employee_id = null`.
- Existing phases keep `started_at = null`.
- Existing phases keep `completed_at = null`.
- Existing phases get `updated_at = now()` as a technical concurrency baseline.
- Existing phases keep `updated_by_employee_id = null` unless a trusted server mutation later supplies the actor.
- No phase is inferred as `COMPLETED`.
- No phase is inferred as `IN_PROGRESS`.

This avoids guessing operational progress from `order_index`.

## Blocking Conditions

Stop the rollout before DDL if any condition is true:

- `public.phases` has `project_id is null`.
- Any `public.phases.project_id` does not exist in `public.projects`.
- Any project has duplicate `(project_id, order_index)`.
- A pre-existing `public.phases.status` column contains null or values outside the final vocabulary.

## Sequential Rule

Foundation derives sequence from `(project_id, order_index)`.

`previous_phase_id` is not stored in this foundation. If the workflow later needs branching, parallelism, or explicit dependencies, create a separate dependency table in a later approved slice.

## Data Impact

The approved forward migration may create baseline values for new nullable/defaulted columns on `public.phases`.

Allowed foundation data effects:

- Existing rows observe `status = NOT_STARTED`.
- Existing rows observe non-null `updated_at`.

No writes to:

- `public.projects`
- `public.tasks`
- `public.project_members`
- `public.employees`
- `public.attendance`
- `public.financial_ledger`
- auth schema

No row insert/delete is expected. `public.phases` row count must remain unchanged.

## Validation

After rollout:

- Every phase status is `NOT_STARTED`.
- `started_at`, `completed_at`, `assignee_employee_id`, `deadline`, and `description` remain null for existing rows.
- No duplicate `(project_id, order_index)`.
- No orphan `project_id`.
- Phase row count remains unchanged.
- Project/task/project_members/employee/access/finance/attendance row counts remain unchanged.
