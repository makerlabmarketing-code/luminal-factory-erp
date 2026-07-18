# Phase Workflow Supersede Note

Date: 2026-07-18

## Superseded / Blocked Migrations

### `20260704153000_move_workflow_to_project_tables.sql`

Classification: SUPERSEDED / BLOCKED.

Do not run. Do not repair as applied.

Reason:

- Contains DML/backfill from `system_settings`.
- Creates broad `anon`/`authenticated` workflow policies.
- Uses legacy `TODO`/`DOING` status semantics.
- Touches `projects`, `phases`, and `tasks` in one migration.
- Overlaps directly with the new Phase Workflow Foundation authority.

Replacement authority:

- `supabase/drafts/20260718_phase_workflow_foundation_final_forward.sql`
- Later approved colorway/stage and task-assignment slices, if needed.

### `20260709110000_add_colorway_stage_fields.sql`

Classification: NOT_APPLIED / BLOCKED.

Do not run without a separate approved colorway/stage schema decision. Do not repair as applied.

Reason:

- Live `public.phases` has not received the 11 colorway/stage fields.
- Stores planned/actual dates as text.
- Adds manual `progress`.
- Adds text `stage_owner`, conflicting with stable employee-id authority.
- It is broader than the current Phase Workflow Foundation.

Replacement authority:

- Phase Workflow Foundation owns phase status, assignment, deadline, and update metadata.
- Colorway/stage fields are deferred to a later dedicated schema slice.

## Documentation Handling

Safe current action:

- Keep this sidecar documentation.
- Do not edit executable migration bodies in the same rollout approval.
- Do not delete historical migration files.

Potential later documentation-only header, after approval:

```sql
-- DO NOT RUN WITHOUT ARCHITECT APPROVAL.
-- Classification: SUPERSEDED / BLOCKED.
-- Replacement authority: supabase/drafts/20260718_phase_workflow_foundation_final_forward.sql
-- Audit date: 2026-07-18.
-- Reason: deprecated workflow/status semantics and unsafe historical drift.
```
