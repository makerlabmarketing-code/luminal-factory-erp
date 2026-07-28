-- READ ONLY. Run after the forward package with authorized and unauthorized fixtures.
begin transaction read only;

select
  has_table_privilege('authenticated', 'public.facilities', 'select') as authenticated_select_granted,
  not has_table_privilege('anon', 'public.facilities', 'select') as anon_select_not_granted,
  (select relrowsecurity from pg_class where oid = 'public.facilities'::regclass) as rls_enabled,
  exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'facilities'
      and policyname = 'facilities authorized directory select'
      and cmd = 'SELECT'
  ) as scoped_select_policy_exists,
  not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'facilities'
      and policyname = 'facilities authorized directory select'
      and cmd <> 'SELECT'
  ) as no_write_policy_added;

-- Operator smoke tests (retain PASS evidence):
-- 1. Admin + SYSTEM_SETTINGS_VIEW reads all expected facility rows.
-- 2. Admin + ATTENDANCE_MANAGE reads all expected facility rows.
-- 3. Admin + EMPLOYEE_VIEW can enrich employee branch_code values.
-- 4. Staff Workspace can read the directory required for assigned-facility attendance.
-- 5. Authenticated fixture with none of those grants reads zero rows.
-- 6. anon and browser INSERT/UPDATE/DELETE attempts remain denied.

rollback;
