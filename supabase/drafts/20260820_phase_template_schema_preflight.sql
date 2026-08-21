-- Phase Template release-one schema preflight.
-- READ ONLY. Do not promote this file to supabase/migrations/.
-- Produces metadata and aggregate counts only; it does not expose business rows.

begin transaction read only;

do $$
begin
  if to_regclass('public.projects') is null
    or to_regclass('public.phases') is null
    or to_regclass('public.tasks') is null
    or to_regclass('public.employees') is null
    or to_regclass('public.project_members') is null
    or to_regclass('public.permissions') is null then
    raise exception 'Phase Template preflight stopped: required source relation is missing.';
  end if;

  if to_regprocedure('public.current_employee_id()') is null
    or to_regprocedure('public.has_workspace_access(text)') is null
    or to_regprocedure('public.has_permission(text)') is null then
    raise exception 'Phase Template preflight stopped: authorization helper is missing.';
  end if;
end $$;

select
  '01 required relation presence' as check_name,
  to_regclass('public.projects') as projects_relation,
  to_regclass('public.phases') as phases_relation,
  to_regclass('public.tasks') as tasks_relation,
  to_regclass('public.employees') as employees_relation,
  to_regclass('public.project_members') as project_members_relation,
  to_regclass('public.permissions') as permissions_relation;

select
  '02 authorization helper presence' as check_name,
  to_regprocedure('public.current_employee_id()') as current_employee_helper,
  to_regprocedure('public.has_workspace_access(text)') as workspace_helper,
  to_regprocedure('public.has_permission(text)') as permission_helper;

select
  table_name,
  column_name,
  data_type,
  udt_name,
  is_nullable,
  column_default,
  ordinal_position
from information_schema.columns
where table_schema = 'public'
  and table_name in (
    'projects',
    'phases',
    'tasks',
    'employees',
    'project_members',
    'permissions'
  )
order by table_name, ordinal_position;

select
  c.conrelid::regclass as table_name,
  c.conname,
  c.contype,
  pg_get_constraintdef(c.oid) as constraint_definition
from pg_constraint c
join pg_namespace n on n.oid = c.connamespace
where n.nspname = 'public'
  and c.conrelid in (
    'public.projects'::regclass,
    'public.phases'::regclass,
    'public.tasks'::regclass,
    'public.employees'::regclass,
    'public.project_members'::regclass,
    'public.permissions'::regclass
  )
order by table_name, c.conname;

select
  schemaname,
  tablename,
  indexname,
  indexdef
from pg_indexes
where schemaname = 'public'
  and tablename in ('projects', 'phases', 'tasks', 'project_members', 'permissions')
order by tablename, indexname;

select
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('projects', 'phases', 'tasks', 'project_members', 'permissions')
order by c.relname;

select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('projects', 'phases', 'tasks', 'project_members', 'permissions')
order by tablename, policyname;

select
  table_name,
  grantee,
  privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('projects', 'phases', 'tasks', 'project_members', 'permissions')
  and grantee in ('PUBLIC', 'anon', 'authenticated', 'service_role')
order by table_name, grantee, privilege_type;

select
  '03 phase-template object collisions' as check_name,
  to_regclass('public.phase_templates') as phase_templates_relation,
  to_regclass('public.phase_template_versions') as versions_relation,
  to_regclass('public.phase_template_stages') as stages_relation,
  to_regclass('public.phase_template_tasks') as tasks_relation,
  to_regclass('public.phase_template_applications') as applications_relation,
  to_regclass('public.phase_template_audit') as audit_relation;

select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as identity_arguments,
  p.prosecdef as security_definer,
  p.proconfig as function_config,
  has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute,
  has_function_privilege('service_role', p.oid, 'EXECUTE') as service_role_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and (
    p.proname like '%phase_template%'
    or p.proname in (
      'current_employee_id',
      'has_workspace_access',
      'has_permission',
      'create_project_atomic'
    )
  )
order by p.proname, identity_arguments;

select
  code,
  description
from public.permissions
where code in (
  'PROJECT_VIEW',
  'PROJECT_MANAGE',
  'PHASE_TEMPLATE_MANAGE'
)
order by code;

select
  '04 aggregate compatibility counts' as check_name,
  (select count(*) from public.projects) as project_count,
  (select count(*) from public.phases) as phase_count,
  (select count(*) from public.tasks) as task_count;

select
  '05 phase order integrity' as check_name,
  count(*) as duplicate_order_groups
from (
  select project_id, order_index
  from public.phases
  where order_index is not null
  group by project_id, order_index
  having count(*) > 1
) duplicate_orders;

select
  '06 approved project-role catalog compatibility' as check_name,
  count(*) filter (
    where role_code not in (
      'PROJECT_OWNER',
      'PROJECT_MANAGER',
      'CREATIVE_LEAD',
      'CONTRIBUTOR'
    )
  ) as unsupported_active_role_rows,
  count(*) as active_role_rows
from public.project_members
where status = 'ACTIVE';

rollback;
