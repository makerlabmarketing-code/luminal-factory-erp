-- DRAFT ONLY - DO NOT RUN WITHOUT EXPLICIT APPROVAL.
-- Phase status/dependency mutation foundation validation draft.

with checks as (
  select 'phase_status_history_table_exists' as check_name,
         to_regclass('public.phase_status_history') is not null as pass
  union all
  select 'phases_status_supported',
         not exists (
           select 1 from public.phases
           where status not in ('ACTIVE', 'LOCKED', 'COMPLETED', 'BLOCKED', 'REVIEW', 'CANCELLED')
         )
  union all
  select 'no_orphan_phase_history_project',
         not exists (
           select 1 from public.phase_status_history h
           left join public.projects p on p.id = h.project_id
           where p.id is null
         )
  union all
  select 'no_orphan_phase_history_phase',
         not exists (
           select 1 from public.phase_status_history h
           left join public.phases ph on ph.id = h.phase_id
           where ph.id is null
         )
  union all
  select 'history_reason_required',
         not exists (
           select 1 from public.phase_status_history
           where reason is null or length(btrim(reason)) = 0
         )
  union all
  select 'history_select_policy_exists',
         exists (
           select 1 from pg_policies
           where schemaname = 'public'
             and tablename = 'phase_status_history'
             and policyname = 'phase status history project view select'
         )
  union all
  select 'transition_rpc_exists',
         to_regprocedure('public.transition_project_phase_status(bigint,bigint,bigint,text,text,text,text,text,boolean)') is not null
  union all
  select 'transition_rpc_not_browser_callable',
         not has_function_privilege('anon', 'public.transition_project_phase_status(bigint,bigint,bigint,text,text,text,text,text,boolean)', 'EXECUTE')
         and not has_function_privilege('authenticated', 'public.transition_project_phase_status(bigint,bigint,bigint,text,text,text,text,text,boolean)', 'EXECUTE')
  union all
  select 'no_history_browser_mutation_policy',
         not exists (
           select 1 from pg_policies
           where schemaname = 'public'
             and tablename = 'phase_status_history'
             and cmd in ('ALL', 'INSERT', 'UPDATE', 'DELETE')
         )
)
select * from checks order by check_name;

select
  (select count(*) from public.phases) as phase_row_count,
  (select count(*) from public.phase_status_history) as phase_history_row_count,
  count(*) filter (where status = 'ACTIVE') as active_count,
  count(*) filter (where status = 'LOCKED') as locked_count,
  count(*) filter (where status = 'COMPLETED') as completed_count,
  count(*) filter (where status in ('BLOCKED', 'REVIEW', 'CANCELLED')) as other_supported_count
from public.phases;
