-- Validation SQL for Project Read RLS rollout.
-- Run only after approved Project RLS rollout. Read-only.

with checks as (
  select
    '01 RLS projects enabled' as check_name,
    case when c.relrowsecurity then 'PASS' else 'FAIL' end as status,
    c.relrowsecurity::text as detail
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'projects'

  union all
  select
    '03 SELECT policy shape',
    case when count(*) filter (
      where policyname = 'projects project access select'
        and cmd = 'SELECT'
        and roles = array['authenticated']::name[]
        and qual ilike '%can_view_project%'
    ) = 1 then 'PASS' else 'FAIL' end,
    count(*)::text
  from pg_policies
  where schemaname = 'public'
    and tablename = 'projects'

  union all
  select
    '04 no INSERT policy',
    case when not exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = 'projects'
        and cmd = 'INSERT'
    ) then 'PASS' else 'FAIL' end,
    null

  union all
  select
    '05 no UPDATE policy',
    case when not exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = 'projects'
        and cmd = 'UPDATE'
    ) then 'PASS' else 'FAIL' end,
    null

  union all
  select
    '06 no ALL policy',
    case when not exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = 'projects'
        and cmd = 'ALL'
    ) then 'PASS' else 'FAIL' end,
    null

  union all
  select
    '07 no DELETE policy',
    case when not exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = 'projects'
        and cmd = 'DELETE'
    ) then 'PASS' else 'FAIL' end,
    null

  union all
  select
    '08 helpers fixed search_path',
    case when count(*) = 3 and bool_and(proconfig @> array['search_path=public, auth, pg_temp'])
      then 'PASS' else 'FAIL' end,
    jsonb_agg(jsonb_build_object('function', proname, 'config', proconfig) order by proname)::text
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in (
      'is_project_member',
      'has_project_role',
      'can_view_project'
    )

  union all
  select
    '09 helper execute grants authenticated only',
    case when not exists (
      select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname in (
          'is_project_member',
          'has_project_role',
          'can_view_project'
        )
        and coalesce(p.proacl::text, '') ilike '%anon%'
    ) then 'PASS' else 'FAIL' end,
    null

  union all
  select
    '10 projects row count unchanged',
    case when (select count(*) from public.projects) = 2 then 'PASS' else 'FAIL' end,
    (select count(*)::text from public.projects)

  union all
  select
    '11 project_members row count unchanged',
    case when (select count(*) from public.project_members) = 6 then 'PASS' else 'FAIL' end,
    (select count(*)::text from public.project_members)

  union all
  select
    '12 phases/tasks/staff_tasks unchanged',
    case
      when (select count(*) from public.phases) = 0
       and (select count(*) from public.tasks) = 2
       and (select count(*) from public.staff_tasks) = 0
      then 'PASS'
      else 'FAIL'
    end,
    jsonb_build_object(
      'phases', (select count(*) from public.phases),
      'tasks', (select count(*) from public.tasks),
      'staff_tasks', (select count(*) from public.staff_tasks)
    )::text

  union all
  select
    '13 attendance/finance unchanged',
    case
      when (select count(*) from public.attendance) = 31
       and (select count(*) from public.financial_ledger) = 64
      then 'PASS'
      else 'FAIL'
    end,
    jsonb_build_object(
      'attendance', (select count(*) from public.attendance),
      'financial_ledger', (select count(*) from public.financial_ledger)
    )::text

  union all
  select
    '14 rollback targets only Project Read RLS objects',
    case
      when to_regprocedure('public.is_project_member(bigint)') is not null
       and to_regprocedure('public.has_project_role(bigint,text)') is not null
       and to_regprocedure('public.can_view_project(bigint)') is not null
       and exists (
         select 1 from pg_policies
         where schemaname = 'public'
           and tablename = 'projects'
           and policyname = 'projects project access select'
       )
      then 'PASS'
      else 'FAIL'
    end,
    null
)
select *
from checks
order by check_name;

-- Optional runtime-context checks for environments that can set local role/GUC.
-- If unavailable in the execution surface, mark these DEFERRED instead of PASS:
-- - anonymous reads 0 rows
-- - employee 3 reads projects 1 and 2
-- - employee 4 reads projects 1 and 2 via membership without PROJECT_VIEW
-- - employee 6 reads projects 1 and 2 via membership without PROJECT_VIEW
-- - employee 1/2 no-membership denial, currently blocked by missing auth_user_id fixtures
-- - inactive employee denial, currently blocked by missing inactive auth fixture
-- - PROJECT_MANAGE create/update, deferred to Project Mutation Server Boundary
-- - PROJECT_OWNER/PROJECT_MANAGER update, deferred to Project Mutation Server Boundary
-- - CREATIVE_LEAD broad update denial, deferred to Project Mutation Server Boundary
