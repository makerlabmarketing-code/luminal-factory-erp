-- Read-only preflight and validation for
-- 20260727044729_phase_status_dependency.sql.

-- Preflight: all result columns must be false before production apply.
select
  exists (select 1 from public.phases where project_id is null)
    as has_null_phase_project_id,
  exists (
    select 1
    from public.phases phase
    left join public.projects project on project.id = phase.project_id
    where project.id is null
  ) as has_orphan_phase_project_id,
  exists (
    select 1
    from public.phases
    group by project_id, order_index
    having count(*) > 1
  ) as has_duplicate_phase_order_index;

-- Post-apply validation.
select
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'phases'
      and column_name = 'status'
      and is_nullable = 'NO'
  ) as phases_status_not_null,
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'phases'
      and column_name = 'updated_at'
      and is_nullable = 'NO'
  ) as phases_updated_at_not_null,
  to_regclass('public.phase_status_history') is not null
    as phase_status_history_present,
  to_regprocedure('public.transition_project_phase_status(bigint,bigint,bigint,text,text,text,text,text,boolean)') is not null
    as transition_project_phase_status_present;
