-- DRAFT ONLY - DO NOT RUN WITHOUT EXPLICIT APPROVAL.
-- Rollback for Phase Workflow Foundation final forward draft.
--
-- Destructive warning:
-- - Drops phase workflow columns and loses persisted status, assignment,
--   deadline, start/completion, and concurrency metadata.
-- - This rollback is intended only before application rollout depends on these
--   fields, or after a separate export/manual rollback plan is approved.
-- - Scope is public.phases plus the phase workflow trigger/function/policy only.

begin;

do $$
begin
  if to_regclass('public.phases') is null then
    raise exception 'Precondition failed: public.phases does not exist.';
  end if;

  if exists (
    select 1
    from public.phases
    where coalesce(status, 'NOT_STARTED') <> 'NOT_STARTED'
       or description is not null
       or deadline is not null
       or assignee_employee_id is not null
       or started_at is not null
       or completed_at is not null
       or updated_by_employee_id is not null
  ) then
    raise exception 'Rollback blocked: phase workflow columns contain operational data. Export and review before destructive rollback.';
  end if;
end $$;

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
  drop column if exists assignee_employee_id,
  drop column if exists deadline,
  drop column if exists status,
  drop column if exists description;

notify pgrst, 'reload schema';

commit;
