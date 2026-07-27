# Production Migration Recovery Plan

## Verified State

- Production project: `kwfmfmpgpbfewpiizesv`.
- Remote migration history is missing local versions `20260704153000`, `20260709110000`, `20260722110928`, `20260723120000`, and `20260727044729`.
- Production already has `public.projects`, `public.phases`, and `public.tasks`.
- Production `public.phases` does not have the colorway/stage columns from `20260709110000`.
- Production `public.phases` does not have `status`, `completed_at`, `updated_at`, or `updated_by_employee_id`.
- Production does not have `public.phase_status_history` or `public.transition_project_phase_status(...)`.
- Production does not have the production-order persistence tables from `20260722110928`.
- Production `public.facilities` does not have `code` or `is_active`.

## Recovery Design

`20260704153000` is replaced with a no-op recovery marker. The original SQL is obsolete and must not run against production because the live `projects`, `phases`, and `tasks` tables already exist with a different reviewed shape.

`20260709110000` remains the required additive migration for phase colorway/stage fields. It is safe only after the obsolete `20260704153000` payload has been removed from the production execution path.

`20260722110928` remains required for production-order persistence. The recovery patch hardens policy creation and the `production_orders_current_stage_fkey` constraint so the migration is safer after partial retries.

`20260723120000` remains required for facility stable codes and active-state filtering. The recovery patch adds an in-transaction duplicate-code preflight before backfilling `facilities.code`.

`20260727044729` remains required for phase status dependency/history. The recovery patch creates the `phases.status` column before validating existing phase status values, removing the invalid dependency on a column that does not yet exist.

## Safe Rollout Order

1. Apply `20260704153000_move_workflow_to_project_tables.sql` as a no-op recovery marker only.
2. Apply `20260709110000_add_colorway_stage_fields.sql`.
3. Apply `20260722110928_corrective_slice_6_production_order_persistence.sql`.
4. Apply `20260723120000_facility_status_code.sql`.
5. Apply `20260727044729_phase_status_dependency.sql`.

## Required Manual Approval

- Review this PR diff and confirm the obsolete `20260704153000` payload is intentionally removed from production execution.
- Run the read-only validation SQL in `supabase/validation/` before approving production rollout.
- Confirm the duplicate facility-code preflight returns zero rows before applying `20260723120000`.
- Confirm no production SQL is executed outside the approved Supabase migration delivery path.

## Rollback Notes

- `20260704153000` rollback is not applicable; it is a no-op marker.
- `20260709110000` rollback would remove additive phase metadata columns only if application code is rolled back first.
- `20260722110928` rollback remains in `supabase/drafts/corrective-slice-6-production-order-persistence/rollback.sql`.
- `20260723120000` rollback remains in `supabase/drafts/20260723_facility_status_code_rollback.sql`.
- `20260727044729` rollback remains in `supabase/drafts/20260721_phase_status_dependency_rollback.sql`.

## Stop Gate

This package stops at production approval. Do not run `db push`, execute SQL, deploy, merge, or repair migration history from Codex.
