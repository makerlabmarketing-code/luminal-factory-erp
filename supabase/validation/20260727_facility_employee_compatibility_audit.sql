-- READ ONLY. Production compatibility audit for facilities and employee assignment values.
-- Run with a role that can inspect information_schema and pg_catalog.
begin transaction read only;

select table_schema, table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('facilities', 'employees', 'attendance', 'attendance_logs')
order by table_name;

select table_name, ordinal_position, column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in ('facilities', 'employees', 'attendance', 'attendance_logs')
  and column_name in (
    'id', 'facility_id', 'facility_code', 'code', 'name', 'facility_name',
    'branch', 'branch_code', 'branch_name', 'campus', 'address', 'latitude',
    'longitude', 'lat', 'lng', 'safe_radius', 'radius', 'status', 'is_active',
    'auth_user_id', 'email', 'created_at', 'updated_at'
  )
order by table_name, ordinal_position;

select count(*) as facility_row_count from public.facilities;

-- Avoids assuming optional column names while returning only facility business data.
select jsonb_strip_nulls(jsonb_build_object(
  'id', facility_json -> 'id',
  'code', coalesce(facility_json -> 'code', facility_json -> 'facility_code'),
  'name', coalesce(facility_json -> 'facility_name', facility_json -> 'name', facility_json -> 'branch_name'),
  'address', facility_json -> 'address',
  'latitude', coalesce(facility_json -> 'lat', facility_json -> 'latitude'),
  'longitude', coalesce(facility_json -> 'lng', facility_json -> 'longitude'),
  'safe_radius', coalesce(facility_json -> 'radius', facility_json -> 'safe_radius'),
  'status', facility_json -> 'status',
  'is_active', facility_json -> 'is_active'
)) as facility
from (select to_jsonb(facility_row) as facility_json from public.facilities facility_row) rows
order by facility_json ->> 'id';

-- Aggregated assignment values only; no employee names, emails, or Auth identifiers.
select
  coalesce(
    employee_json ->> 'facility_id', employee_json ->> 'facility_code',
    employee_json ->> 'branch_code', employee_json ->> 'facility_name',
    employee_json ->> 'branch_name', employee_json ->> 'campus', employee_json ->> 'branch'
  ) as stored_facility_value,
  count(*) as employee_count
from (select to_jsonb(employee_row) as employee_json from public.employees employee_row) rows
group by stored_facility_value
order by stored_facility_value nulls first;

select
  kcu.constraint_name,
  kcu.table_name,
  kcu.column_name,
  foreign_table_name,
  foreign_column_name
from information_schema.constraint_column_usage ccu
join information_schema.key_column_usage kcu using (constraint_catalog, constraint_schema, constraint_name)
join information_schema.referential_constraints rc using (constraint_catalog, constraint_schema, constraint_name)
join lateral (
  select ccu2.table_name as foreign_table_name, ccu2.column_name as foreign_column_name
  from information_schema.constraint_column_usage ccu2
  where ccu2.constraint_catalog = rc.unique_constraint_catalog
    and ccu2.constraint_schema = rc.unique_constraint_schema
    and ccu2.constraint_name = rc.unique_constraint_name
  limit 1
) foreign_key on true
where kcu.table_schema = 'public'
  and kcu.table_name in ('employees', 'attendance', 'attendance_logs')
order by table_name, constraint_name;

select c.relname as table_name, c.relrowsecurity as rls_enabled, c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname in ('facilities', 'employees', 'attendance', 'attendance_logs');

select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public' and tablename in ('facilities', 'employees', 'attendance', 'attendance_logs')
order by tablename, policyname;

select table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('facilities', 'employees', 'attendance', 'attendance_logs')
  and grantee in ('anon', 'authenticated', 'service_role')
order by table_name, grantee, privilege_type;

rollback;
