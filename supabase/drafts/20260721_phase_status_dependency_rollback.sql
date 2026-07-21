-- DRAFT ONLY - DO NOT RUN WITHOUT EXPLICIT APPROVAL.
-- Phase status/dependency mutation foundation rollback draft.

begin;

do $$
begin
  if to_regclass('public.phase_status_history') is not null then
    drop policy if exists "phase status history project view select" on public.phase_status_history;
  end if;
end $$;

drop index if exists public.phase_status_history_project_phase_created_idx;
drop index if exists public.phases_project_status_idx;
drop table if exists public.phase_status_history;

alter table if exists public.phases
  drop constraint if exists phases_status_check,
  drop constraint if exists phases_updated_by_employee_id_fkey;

-- Preserve phase.status/completed_at/updated_at columns by default to avoid data loss.
-- Dropping those columns requires separate destructive approval after export.

commit;
