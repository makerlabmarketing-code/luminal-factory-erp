-- Read-only validation for Batch 3E1 own-row RLS package.
-- Run after approved Supabase GitHub Integration delivery.

select 'employees_rls_enabled' as check_name,
  case when c.relrowsecurity then 'PASS' else 'FAIL' end as status,
  c.relrowsecurity::text as detail
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'employees';

select 'attendance_rls_enabled' as check_name,
  case when bool_and(c.relrowsecurity) then 'PASS' else 'FAIL' end as status,
  jsonb_object_agg(c.relname, c.relrowsecurity)::text as detail
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('attendance', 'attendance_logs');

select 'employees_own_profile_policy_exists' as check_name,
  case when exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'employees'
      and policyname = 'employees staff own profile select'
      and cmd = 'SELECT'
      and roles = '{authenticated}'
      and qual ~ 'auth_user_id'
      and qual ~ 'auth.uid'
      and qual ~ 'STAFF_WORKSPACE'
  ) then 'PASS' else 'FAIL' end as status,
  coalesce((
    select qual
    from pg_policies
    where schemaname = 'public'
      and tablename = 'employees'
      and policyname = 'employees staff own profile select'
  ), 'missing') as detail;

select 'employees_no_broad_authenticated_policy' as check_name,
  case when not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'employees'
      and roles && array['authenticated']::name[]
      and cmd in ('SELECT', 'ALL')
      and coalesce(qual, '') !~ 'auth.uid|current_employee_id|has_permission|has_workspace_access|is_app_admin'
  ) then 'PASS' else 'FAIL' end as status,
  coalesce(jsonb_agg(policyname order by policyname)::text, '[]') as detail
from pg_policies
where schemaname = 'public'
  and tablename = 'employees'
  and roles && array['authenticated']::name[]
  and cmd in ('SELECT', 'ALL')
  and coalesce(qual, '') !~ 'auth.uid|current_employee_id|has_permission|has_workspace_access|is_app_admin';

select 'attendance_own_row_policies_still_exist' as check_name,
  case when count(*) = 6 then 'PASS' else 'FAIL' end as status,
  jsonb_agg(policyname order by policyname)::text as detail
from pg_policies
where schemaname = 'public'
  and tablename in ('attendance', 'attendance_logs')
  and policyname in (
    'attendance staff own select',
    'attendance staff own insert',
    'attendance staff own update',
    'attendance logs staff own select',
    'attendance logs staff own insert',
    'attendance logs staff own update'
  );
