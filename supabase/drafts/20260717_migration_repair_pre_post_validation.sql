-- Migration Repair pre/post validation.
-- Read-only. Safe to run before and after metadata repair.
-- This validates live schema/object/data invariants; it does not mutate data.

select
  'linked remote migration history' as section,
  version,
  name
from supabase_migrations.schema_migrations
order by version;

select
  'row_count' as section,
  'employees' as object_name,
  count(*)::text as observed
from public.employees
union all
select 'row_count', 'employee_workspace_access', count(*)::text from public.employee_workspace_access
union all
select 'row_count', 'employee_permissions', count(*)::text from public.employee_permissions
union all
select 'row_count', 'permissions', count(*)::text from public.permissions
union all
select 'row_count', 'project_members', count(*)::text from public.project_members
union all
select 'row_count', 'projects', count(*)::text from public.projects
union all
select 'row_count', 'phases', count(*)::text from public.phases
union all
select 'row_count', 'tasks', count(*)::text from public.tasks
union all
select 'row_count', 'attendance', count(*)::text from public.attendance
union all
select 'row_count', 'financial_ledger', count(*)::text from public.financial_ledger
order by object_name;

select
  'candidate_functions' as section,
  p.proname,
  pg_get_function_identity_arguments(p.oid) as identity_args,
  pg_get_function_result(p.oid) as result_type,
  pg_get_userbyid(p.proowner) as owner_name,
  p.prosecdef as security_definer,
  p.provolatile as volatility,
  p.proconfig,
  md5(pg_get_functiondef(p.oid)) as definition_md5,
  pg_get_functiondef(p.oid) as definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'is_app_admin',
    'set_access_permissions_updated_at',
    'current_employee_id',
    'has_workspace_access',
    'has_permission',
    'can_access_admin',
    'can_access_staff',
    'set_project_members_audit_fields',
    'is_project_member',
    'has_project_role',
    'can_view_project'
  )
order by p.proname, pg_get_function_identity_arguments(p.oid);

select
  'candidate_policies' as section,
  tablename,
  policyname,
  cmd,
  roles,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and (
    (tablename = 'financial_ledger' and policyname = 'financial ledger admin select')
    or (tablename = 'employees' and policyname = 'employees admin employee view select')
    or tablename in ('employee_workspace_access', 'permissions', 'employee_permissions', 'project_members')
    or (tablename = 'projects' and policyname = 'projects project access select')
  )
order by tablename, policyname;

select
  'candidate_constraints' as section,
  c.relname as table_name,
  con.conname,
  con.contype,
  con.convalidated,
  pg_get_constraintdef(con.oid, true) as definition
from pg_constraint con
join pg_class c on c.oid = con.conrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in (
    'employee_workspace_access',
    'permissions',
    'employee_permissions',
    'project_members'
  )
order by c.relname, con.conname;

select
  'candidate_indexes' as section,
  tablename,
  indexname,
  indexdef
from pg_indexes
where schemaname = 'public'
  and tablename in (
    'employee_workspace_access',
    'permissions',
    'employee_permissions',
    'project_members'
  )
order by tablename, indexname;

select
  'candidate_triggers' as section,
  c.relname as table_name,
  t.tgname,
  t.tgenabled,
  pg_get_triggerdef(t.oid, true) as definition
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in (
    'employee_workspace_access',
    'employee_permissions',
    'project_members'
  )
  and not t.tgisinternal
order by c.relname, t.tgname;

select
  'routine_grants' as section,
  routine_name,
  grantee,
  privilege_type
from information_schema.routine_privileges
where routine_schema = 'public'
  and routine_name in (
    'is_app_admin',
    'set_access_permissions_updated_at',
    'current_employee_id',
    'has_workspace_access',
    'has_permission',
    'can_access_admin',
    'can_access_staff',
    'set_project_members_audit_fields',
    'is_project_member',
    'has_project_role',
    'can_view_project'
  )
  and grantee in ('anon', 'authenticated', 'public')
order by routine_name, grantee, privilege_type;

select
  'access_drift_validity' as section,
  check_name,
  issue_count::text as observed
from (
  select 'workspace_invalid_employee_fk' as check_name, count(*) as issue_count
  from public.employee_workspace_access ewa
  left join public.employees e on e.id = ewa.employee_id
  where e.id is null

  union all
  select 'workspace_invalid_granted_by_fk', count(*)
  from public.employee_workspace_access ewa
  left join public.employees e on e.id = ewa.granted_by_employee_id
  where ewa.granted_by_employee_id is not null
    and e.id is null

  union all
  select 'workspace_invalid_workspace', count(*)
  from public.employee_workspace_access
  where workspace not in ('STAFF_WORKSPACE', 'ADMIN_WORKSPACE')

  union all
  select 'workspace_invalid_status', count(*)
  from public.employee_workspace_access
  where status not in ('ACTIVE', 'INACTIVE')

  union all
  select 'workspace_active_revoked_at', count(*)
  from public.employee_workspace_access
  where status = 'ACTIVE'
    and revoked_at is not null

  union all
  select 'workspace_duplicate_active', count(*)
  from (
    select employee_id, workspace
    from public.employee_workspace_access
    where status = 'ACTIVE'
    group by employee_id, workspace
    having count(*) > 1
  ) d

  union all
  select 'permission_invalid_employee_fk', count(*)
  from public.employee_permissions ep
  left join public.employees e on e.id = ep.employee_id
  where e.id is null

  union all
  select 'permission_invalid_granted_by_fk', count(*)
  from public.employee_permissions ep
  left join public.employees e on e.id = ep.granted_by_employee_id
  where ep.granted_by_employee_id is not null
    and e.id is null

  union all
  select 'permission_invalid_code_fk', count(*)
  from public.employee_permissions ep
  left join public.permissions p on p.code = ep.permission_code
  where p.code is null

  union all
  select 'permission_invalid_effect', count(*)
  from public.employee_permissions
  where effect not in ('ALLOW', 'DENY')

  union all
  select 'permission_invalid_status', count(*)
  from public.employee_permissions
  where status not in ('ACTIVE', 'INACTIVE')

  union all
  select 'permission_active_revoked_at', count(*)
  from public.employee_permissions
  where status = 'ACTIVE'
    and revoked_at is not null

  union all
  select 'permission_duplicate_active_effect', count(*)
  from (
    select employee_id, permission_code, effect
    from public.employee_permissions
    where status = 'ACTIVE'
    group by employee_id, permission_code, effect
    having count(*) > 1
  ) d
) checks
order by check_name;

select
  'phase_exclusion_guard' as section,
  jsonb_build_object(
    '20260709110000_columns_present',
    (
      select count(*)
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'phases'
        and column_name in (
          'colorway_name',
          'colorway_code',
          'stage_type',
          'stage_owner',
          'planned_start_date',
          'planned_end_date',
          'actual_start_date',
          'actual_end_date',
          'progress',
          'next_action',
          'required_review'
        )
    ),
    '20260709110000_index_present',
    exists (
      select 1
      from pg_indexes
      where schemaname = 'public'
        and tablename = 'phases'
        and indexname = 'phases_project_colorway_order_idx'
    )
  ) as observed;
