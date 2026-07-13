-- Validation SQL for Batch 3C4 RLS slice 1.
-- Replace placeholder UUIDs only in your SQL runner/session.
-- Do not commit real Auth UUIDs.

-- PRE-RUN REVIEW CHECKS

select
  p.proname as function_name,
  pg_get_userbyid(p.proowner) as owner_name,
  p.prosecdef as security_definer,
  p.provolatile as volatility,
  p.proconfig as function_config
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'is_app_admin';

select
  c.relname,
  c.relkind,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as force_rls
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('financial_ledger', 'employees');

select
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('financial_ledger', 'employees')
order by tablename, policyname;

select
  grantee,
  privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name = 'financial_ledger'
  and grantee in ('anon', 'authenticated')
order by grantee, privilege_type;

select
  count(*) as financial_ledger_rows_before
from public.financial_ledger;

-- POST-ROLLOUT STRUCTURE CHECKS

select
  p.proname as function_name,
  pg_get_functiondef(p.oid) as function_definition,
  pg_get_userbyid(p.proowner) as owner_name,
  p.prosecdef as security_definer,
  p.proconfig as function_config
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'is_app_admin';

select
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename = 'financial_ledger'
  and policyname = 'financial ledger admin select';

select
  grantee,
  privilege_type
from information_schema.routine_privileges
where specific_schema = 'public'
  and routine_name = 'is_app_admin'
order by grantee, privilege_type;

-- SECURITY TEST CASES
-- Run each case in its own transaction. Use real test Auth UUIDs only in the
-- SQL runner. Never commit real UUIDs.

-- Case 1: anonymous cannot read financial_ledger.
begin;
  set local role anon;
  reset "request.jwt.claim.sub";
  select count(*) as anon_visible_rows
  from public.financial_ledger;
rollback;

-- Case 2: STAFF ACTIVE cannot read financial_ledger.
begin;
  set local role authenticated;
  set local "request.jwt.claim.sub" = '<STAFF_ACTIVE_AUTH_UUID>';
  select public.is_app_admin() as staff_is_admin;
  select count(*) as staff_visible_rows
  from public.financial_ledger;
rollback;

-- Case 3: ADMIN ACTIVE can read financial_ledger.
begin;
  set local role authenticated;
  set local "request.jwt.claim.sub" = '<ADMIN_ACTIVE_AUTH_UUID>';
  select public.is_app_admin() as admin_is_admin;
  select count(*) as admin_visible_rows
  from public.financial_ledger;
rollback;

-- Case 4: OWNER ACTIVE can read financial_ledger if OWNER compatibility is enabled.
begin;
  set local role authenticated;
  set local "request.jwt.claim.sub" = '<OWNER_ACTIVE_AUTH_UUID>';
  select public.is_app_admin() as owner_is_admin;
  select count(*) as owner_visible_rows
  from public.financial_ledger;
rollback;

-- Case 5: ADMIN INACTIVE cannot read financial_ledger.
begin;
  set local role authenticated;
  set local "request.jwt.claim.sub" = '<ADMIN_INACTIVE_AUTH_UUID>';
  select public.is_app_admin() as inactive_admin_is_admin;
  select count(*) as inactive_admin_visible_rows
  from public.financial_ledger;
rollback;

-- Case 6: mapped Auth user missing employees row cannot read financial_ledger.
begin;
  set local role authenticated;
  set local "request.jwt.claim.sub" = '<UNMAPPED_AUTH_UUID>';
  select public.is_app_admin() as unmapped_is_admin;
  select count(*) as unmapped_visible_rows
  from public.financial_ledger;
rollback;

-- Case 7: policy does not depend on email or full_name.
select
  pg_get_functiondef(p.oid) not ilike '%email%' as function_ignores_email,
  pg_get_functiondef(p.oid) not ilike '%full_name%' as function_ignores_full_name
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'is_app_admin';

-- Case 8: data was not changed by migration.
select
  count(*) as financial_ledger_rows_after
from public.financial_ledger;

-- Case 9: schema changed only by helper function and financial_ledger policy.
select
  n.nspname as schema_name,
  p.proname as function_name
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'is_app_admin';

select
  schemaname,
  tablename,
  policyname,
  cmd,
  roles
from pg_policies
where schemaname = 'public'
  and policyname = 'financial ledger admin select';
