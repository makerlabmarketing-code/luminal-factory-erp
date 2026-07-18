-- Migration History Drift Reconciliation validation draft.
-- Read-only. Do not run as part of this pre-run audit unless explicitly approved.
-- Intended execution surface:
--   npx.cmd supabase db query --linked --file supabase/drafts/20260717_migration_history_drift_reconciliation_validation.sql

select 'remote migration history' as check_name, version, name
from supabase_migrations.schema_migrations
order by version;

select
  'project_members columns' as check_name,
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'project_members'
order by ordinal_position;

select
  'project_members constraints' as check_name,
  conname,
  contype,
  convalidated,
  pg_get_constraintdef(oid, true) as definition
from pg_constraint
where conrelid = 'public.project_members'::regclass
order by conname;

select
  'project_members indexes' as check_name,
  indexname,
  indexdef
from pg_indexes
where schemaname = 'public'
  and tablename = 'project_members'
order by indexname;

select
  'project_members policies' as check_name,
  policyname,
  cmd,
  roles,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename = 'project_members'
order by policyname;

select
  'project_members trigger' as check_name,
  t.tgname,
  t.tgenabled,
  pg_get_triggerdef(t.oid, true) as definition
from pg_trigger t
where t.tgrelid = 'public.project_members'::regclass
  and not t.tgisinternal
order by t.tgname;

select
  'project/project_members helper definitions' as check_name,
  p.proname,
  pg_get_function_identity_arguments(p.oid) as identity_args,
  r.rolname as owner,
  p.prosecdef as security_definer,
  p.provolatile as volatility,
  p.proconfig,
  pg_get_functiondef(p.oid) as definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
join pg_roles r on r.oid = p.proowner
where n.nspname = 'public'
  and p.proname in (
    'set_project_members_audit_fields',
    'is_project_member',
    'has_project_role',
    'can_view_project'
  )
order by p.proname, pg_get_function_identity_arguments(p.oid);

select
  'project policy' as check_name,
  policyname,
  cmd,
  roles,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename = 'projects'
  and policyname = 'projects project access select';

select
  'phase current columns' as check_name,
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'phases'
order by ordinal_position;

select
  'phase foundation object absence before rollout' as check_name,
  jsonb_build_object(
    'description_column', exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'phases' and column_name = 'description'
    ),
    'status_column', exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'phases' and column_name = 'status'
    ),
    'assignee_employee_id_column', exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'phases' and column_name = 'assignee_employee_id'
    ),
    'deadline_column', exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'phases' and column_name = 'deadline'
    ),
    'updated_at_column', exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'phases' and column_name = 'updated_at'
    ),
    'phase_policy', exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = 'phases'
        and policyname = 'phases project access select'
    ),
    'phase_audit_function', to_regprocedure('public.set_phase_workflow_audit_fields()') is not null,
    'phase_updated_at_function', to_regprocedure('public.set_phase_workflow_updated_at()') is not null
  ) as detail;

select
  'workflow public policies must be absent' as check_name,
  policyname,
  tablename,
  cmd,
  roles,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and policyname in (
    'workflow projects public access',
    'workflow phases public access',
    'workflow tasks public access'
  )
order by tablename, policyname;

select
  'table grants for workflow tables' as check_name,
  table_name,
  grantee,
  privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('projects', 'phases', 'tasks', 'project_members')
  and grantee in ('anon', 'authenticated', 'public')
order by table_name, grantee, privilege_type;

-- Part 2: additional local-only migration validation checks.
-- Read-only. These checks support classification of:
-- 20260709110000, 20260713111027, 20260714082140, 20260715030000.

select
  'part2 remote migration history' as check_name,
  version,
  name
from supabase_migrations.schema_migrations
where version in (
  '20260709110000',
  '20260713111027',
  '20260714082140',
  '20260715030000'
)
order by version;

select
  '20260709110000 phase colorway columns should be absent before decision' as check_name,
  column_name,
  data_type,
  is_nullable,
  column_default
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
order by column_name;

select
  '20260709110000 phase colorway index should be absent before decision' as check_name,
  indexname,
  indexdef
from pg_indexes
where schemaname = 'public'
  and tablename = 'phases'
  and indexname = 'phases_project_colorway_order_idx';

select
  '20260713111027 is_app_admin definition' as check_name,
  p.proname,
  pg_get_function_identity_arguments(p.oid) as identity_args,
  pg_get_function_result(p.oid) as result_type,
  pg_get_userbyid(p.proowner) as owner_name,
  p.prosecdef as security_definer,
  p.provolatile as volatility,
  p.proconfig,
  pg_get_functiondef(p.oid) as definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'is_app_admin';

select
  '20260713111027 financial ledger policy' as check_name,
  policyname,
  cmd,
  roles,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename = 'financial_ledger'
  and policyname = 'financial ledger admin select';

select
  '20260714082140 foundation columns' as check_name,
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in (
    'employee_workspace_access',
    'permissions',
    'employee_permissions'
  )
order by table_name, ordinal_position;

select
  '20260714082140 foundation constraints' as check_name,
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
    'employee_permissions'
  )
order by c.relname, con.conname;

select
  '20260714082140 foundation indexes' as check_name,
  tablename,
  indexname,
  indexdef
from pg_indexes
where schemaname = 'public'
  and tablename in (
    'employee_workspace_access',
    'permissions',
    'employee_permissions'
  )
order by tablename, indexname;

select
  '20260714082140 foundation policies' as check_name,
  tablename,
  policyname,
  cmd,
  roles,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename in (
    'employee_workspace_access',
    'permissions',
    'employee_permissions'
  )
order by tablename, policyname;

select
  '20260714082140 foundation triggers' as check_name,
  c.relname as table_name,
  t.tgname,
  t.tgenabled,
  pg_get_triggerdef(t.oid, true) as definition
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('employee_workspace_access', 'employee_permissions')
  and not t.tgisinternal
order by c.relname, t.tgname;

select
  '20260714082140 foundation helper definitions' as check_name,
  p.proname,
  pg_get_function_identity_arguments(p.oid) as identity_args,
  pg_get_function_result(p.oid) as result_type,
  pg_get_userbyid(p.proowner) as owner_name,
  p.prosecdef as security_definer,
  p.provolatile as volatility,
  p.proconfig,
  pg_get_functiondef(p.oid) as definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'set_access_permissions_updated_at',
    'current_employee_id',
    'has_workspace_access',
    'has_permission',
    'can_access_admin',
    'can_access_staff'
  )
order by p.proname, pg_get_function_identity_arguments(p.oid);

select
  '20260714082140 permission catalog rows' as check_name,
  code,
  description
from public.permissions
order by code;

select
  '20260714082140 foundation row counts' as check_name,
  'permissions' as table_name,
  count(*) as row_count
from public.permissions
union all
select
  '20260714082140 foundation row counts',
  'employee_workspace_access',
  count(*)
from public.employee_workspace_access
union all
select
  '20260714082140 foundation row counts',
  'employee_permissions',
  count(*)
from public.employee_permissions
order by table_name;

select
  '20260715030000 employees admin policy' as check_name,
  policyname,
  cmd,
  roles,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename = 'employees'
  and policyname = 'employees admin employee view select';

select
  'part2 routine grants' as check_name,
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
    'can_access_staff'
  )
  and grantee in ('anon', 'authenticated', 'public')
order by routine_name, grantee, privilege_type;
