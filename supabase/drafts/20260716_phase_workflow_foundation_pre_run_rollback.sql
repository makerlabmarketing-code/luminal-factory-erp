-- DRAFT ONLY - DO NOT RUN WITHOUT APPROVAL.
-- Rollback for Phase Workflow Foundation pre-run forward draft.
--
-- Destructive warning:
-- - Dropping these columns loses persisted phase description/status/assignee/
--   deadline/start/completion/concurrency data.
-- - Run only before the UI/API depends on these fields or after exporting data.
-- - Scope is public.phases only plus the phase read policy/trigger/function.

begin;

drop policy if exists "phases project access select" on public.phases;

drop trigger if exists phases_set_workflow_audit_fields on public.phases;
drop function if exists public.set_phase_workflow_audit_fields();

drop index if exists public.phases_updated_at_idx;
drop index if exists public.phases_deadline_idx;
drop index if exists public.phases_assignee_employee_id_idx;
drop index if exists public.phases_project_status_order_idx;
drop index if exists public.phases_project_order_unique;

alter table public.phases
  drop constraint if exists phases_started_completed_order_check,
  drop constraint if exists phases_completed_at_status_check,
  drop constraint if exists phases_updated_by_employee_id_fkey,
  drop constraint if exists phases_assignee_employee_id_fkey,
  drop constraint if exists phases_status_check;

alter table public.phases
  drop column if exists updated_by_employee_id,
  drop column if exists updated_at,
  drop column if exists completed_at,
  drop column if exists started_at,
  drop column if exists deadline,
  drop column if exists assignee_employee_id,
  drop column if exists status,
  drop column if exists description;

commit;
