-- Project Membership Slice 0 baseline verification.
-- READ-ONLY: do not run as a migration, backfill, or mutation.
-- Scope: catalog metadata plus aggregate integrity checks over project_members,
-- projects, employees, and normalized task assignments.

select
  '01 relation presence' as check_name,
  to_regclass('public.projects') as projects_relation,
  to_regclass('public.employees') as employees_relation,
  to_regclass('public.project_members') as project_members_relation,
  to_regclass('public.tasks') as tasks_relation;

select
  table_name,
  column_name,
  data_type,
  is_nullable,
  ordinal_position
from information_schema.columns
where table_schema = 'public'
  and table_name in ('projects', 'employees', 'project_members', 'tasks')
  and (
    table_name <> 'project_members'
    or column_name in (
      'id', 'project_id', 'employee_id', 'role_code', 'status',
      'granted_at', 'granted_by_employee_id', 'revoked_at',
      'revoked_by_employee_id', 'created_at', 'updated_at'
    )
  )
order by table_name, ordinal_position;

select
  conrelid::regclass as table_name,
  conname,
  pg_get_constraintdef(oid) as constraint_definition
from pg_constraint
where conrelid in (
  'public.projects'::regclass,
  'public.employees'::regclass,
  'public.project_members'::regclass,
  'public.tasks'::regclass
)
order by table_name, conname;

select
  schemaname,
  tablename,
  indexname,
  indexdef
from pg_indexes
where schemaname = 'public'
  and tablename in ('projects', 'project_members', 'tasks')
order by tablename, indexname;

select
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('projects', 'project_members', 'tasks');

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
  and tablename in ('projects', 'project_members', 'tasks')
order by tablename, policyname;

select
  table_name,
  grantee,
  privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('projects', 'project_members', 'tasks')
  and grantee in ('anon', 'authenticated')
order by table_name, grantee, privilege_type;

select
  '02 active duplicate employee roles' as check_name,
  count(*) as duplicate_group_count
from (
  select project_id, employee_id
  from public.project_members
  where status = 'ACTIVE'
  group by project_id, employee_id
  having count(*) > 1
) duplicate_groups;

select
  project_id,
  employee_id,
  count(*) as active_role_count,
  array_agg(role_code order by role_code) as active_roles
from public.project_members
where status = 'ACTIVE'
group by project_id, employee_id
having count(*) > 1
order by project_id, employee_id;

select
  '03 active memberships with inactive employees' as check_name,
  count(*) as affected_rows
from public.project_members pm
join public.employees e on e.id = pm.employee_id
where pm.status = 'ACTIVE'
  and (coalesce(e.is_active, true) = false or upper(coalesce(e.status, '')) in ('INACTIVE', 'LOCKED', 'DISABLED', 'DELETED'));

select
  '04 projects without an active owner' as check_name,
  count(*) as affected_projects
from public.projects p
where not exists (
  select 1
  from public.project_members pm
  where pm.project_id = p.id
    and pm.status = 'ACTIVE'
    and pm.role_code = 'PROJECT_OWNER'
);

select
  '05 active task assignments without active project membership' as check_name,
  count(*) as affected_tasks
from public.tasks t
where t.assignee_employee_id is not null
  and not exists (
    select 1
    from public.project_members pm
    join public.employees e on e.id = pm.employee_id
    where pm.project_id = t.project_id
      and pm.employee_id = t.assignee_employee_id
      and pm.status = 'ACTIVE'
      and coalesce(e.is_active, true) = true
      and upper(coalesce(e.status, 'ACTIVE')) = 'ACTIVE'
  );

select
  '06 normalized project code state' as check_name,
  count(*) filter (where project_code is null or length(btrim(project_code)) = 0) as blank_or_null_codes,
  count(*) filter (where project_code is not null) as populated_codes,
  count(*) as total_projects
from public.projects;

select
  upper(btrim(project_code)) as normalized_project_code,
  count(*) as duplicate_count
from public.projects
where project_code is not null
group by upper(btrim(project_code))
having count(*) > 1
order by normalized_project_code;

select
  lower(btrim(project_name)) as normalized_project_name,
  count(*) as project_count
from public.projects
where project_name is not null
group by lower(btrim(project_name))
having count(*) > 1
order by normalized_project_name;

select
  p.status,
  count(*) as active_membership_count
from public.project_members pm
join public.projects p on p.id = pm.project_id
where pm.status = 'ACTIVE'
group by p.status
order by p.status;

select
  proname,
  pg_get_function_identity_arguments(oid) as identity_arguments,
  prosecdef as security_definer,
  has_function_privilege('anon', oid, 'EXECUTE') as anon_execute,
  has_function_privilege('authenticated', oid, 'EXECUTE') as authenticated_execute,
  has_function_privilege('service_role', oid, 'EXECUTE') as service_role_execute
from pg_proc
where pronamespace = 'public'::regnamespace
  and proname in ('create_project_atomic', 'create_project_task_atomic');

select
  '07 membership audit columns' as check_name,
  count(*) filter (where column_name = 'granted_by_employee_id') as grant_actor_columns,
  count(*) filter (where column_name = 'revoked_by_employee_id') as revoke_actor_columns,
  count(*) filter (where column_name = 'granted_at') as grant_timestamps,
  count(*) filter (where column_name = 'revoked_at') as revoke_timestamps,
  count(*) filter (where column_name in ('reason', 'correlation_id')) as reason_or_correlation_columns
from information_schema.columns
where table_schema = 'public'
  and table_name = 'project_members';
