-- READ ONLY. Employee create production-schema preflight.
-- Safe for Supabase SQL Editor or an approved psql session. Do not add DDL/DML.
begin transaction read only;

select 'employees_table' as section,
       to_regclass('public.employees') is not null as exists;

select 'employee_columns' as section,
       column_name,
       data_type,
       udt_name,
       is_nullable,
       column_default,
       is_identity,
       is_generated
from information_schema.columns
where table_schema = 'public' and table_name = 'employees'
order by ordinal_position;

select 'employee_constraints' as section,
       constraint_name,
       constraint_type,
       pg_get_constraintdef(pc.oid, true) as definition,
       pc.convalidated as validated
from information_schema.table_constraints tc
join pg_namespace pn on pn.nspname = tc.constraint_schema
join pg_constraint pc on pc.connamespace = pn.oid and pc.conname = tc.constraint_name
where tc.table_schema = 'public' and tc.table_name = 'employees'
order by constraint_type, constraint_name;

select 'employee_triggers' as section,
       trigger_name,
       event_manipulation,
       action_timing,
       action_orientation,
       action_statement
from information_schema.triggers
where event_object_schema = 'public' and event_object_table = 'employees'
order by trigger_name, event_manipulation;

select 'employee_rls' as section,
       c.relrowsecurity as rls_enabled,
       c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'employees';

select 'employee_policies' as section,
       policyname,
       permissive,
       roles,
       cmd,
       qual,
       with_check
from pg_policies
where schemaname = 'public' and tablename = 'employees'
order by policyname;

select 'employee_grants' as section,
       grantee,
       privilege_type,
       is_grantable
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name = 'employees'
  and grantee in ('anon', 'authenticated', 'service_role')
order by grantee, privilege_type;

select 'facility_reference_shape' as section,
       column_name,
       data_type,
       udt_name,
       is_nullable,
       column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'facilities'
  and column_name in ('id', 'code', 'facility_name', 'is_active')
order by ordinal_position;

select 'fixture_predicates' as section,
       to_regclass('public.facilities') is not null as facilities_table_exists,
       case when to_regclass('public.facilities') is null then null else
         exists(select 1 from public.facilities where to_jsonb(facilities) ->> 'code' = 'X_NG_CH_NH_LUMINAL')
       end as branch_code_exists,
       exists(
         select 1 from public.employees
         where lower(btrim(to_jsonb(employees) ->> 'email')) = 'makerlab.marketing@gmail.com'
       ) as normalized_email_exists,
       exists(
         select 1 from public.employees
         where lower(btrim(to_jsonb(employees) ->> 'email')) = 'makerlab.marketing@gmail.com'
           and nullif(to_jsonb(employees) ->> 'auth_user_id', '') is not null
       ) as employee_auth_link_exists;

select 'status_role_constraints' as section,
       pc.conname as constraint_name,
       pg_get_constraintdef(pc.oid, true) as definition
from pg_constraint pc
join pg_class c on c.oid = pc.conrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname = 'employees'
  and pc.contype = 'c'
  and (pg_get_constraintdef(pc.oid, true) ilike '%status%'
    or pg_get_constraintdef(pc.oid, true) ilike '%role%')
order by pc.conname;

select 'auth_reference_metadata' as section,
       pc.conname as constraint_name,
       pg_get_constraintdef(pc.oid, true) as definition
from pg_constraint pc
join pg_class c on c.oid = pc.conrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname = 'employees'
  and pc.contype = 'f'
  and pg_get_constraintdef(pc.oid, true) ilike '%auth_user_id%';

select 'migration_ledger_metadata' as section,
       exists(
         select 1 from information_schema.tables
         where table_schema = 'supabase_migrations' and table_name = 'schema_migrations'
       ) as migration_ledger_exists;

rollback;
