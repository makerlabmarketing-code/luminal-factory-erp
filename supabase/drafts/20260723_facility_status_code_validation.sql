-- Facility active-state and stable-code read-only validation package.
-- Run after approved forward execution; do not mutate data here.

set transaction read only;

select 'facility_code_column_exists' as check_name,
  case when exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'facilities' and column_name = 'code' and data_type = 'text' and is_nullable = 'NO'
  ) then 'PASS' else 'FAIL' end as status
union all
select 'facility_is_active_column_exists',
  case when exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'facilities' and column_name = 'is_active' and data_type = 'boolean' and is_nullable = 'NO'
  ) then 'PASS' else 'FAIL' end
union all
select 'facility_code_unique_index_exists',
  case when exists (
    select 1 from pg_indexes where schemaname = 'public' and tablename = 'facilities' and indexname = 'facilities_code_unique_idx'
  ) then 'PASS' else 'FAIL' end
union all
select 'facility_active_index_exists',
  case when exists (
    select 1 from pg_indexes where schemaname = 'public' and tablename = 'facilities' and indexname = 'facilities_active_idx'
  ) then 'PASS' else 'FAIL' end
union all
select 'facility_codes_populated',
  case when not exists (select 1 from public.facilities where code is null or btrim(code) = '') then 'PASS' else 'FAIL' end
union all
select 'facility_codes_unique',
  case when not exists (select code from public.facilities group by code having count(*) > 1) then 'PASS' else 'FAIL' end
union all
select 'existing_facilities_default_active',
  case when not exists (select 1 from public.facilities where is_active is distinct from true) then 'PASS' else 'FAIL' end
union all
select 'no_broad_authenticated_facility_write_policy',
  case when not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'facilities'
      and roles::text ~ 'authenticated'
      and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
      and coalesce(qual, '') !~ 'has_permission|has_workspace_access|is_app_admin'
      and coalesce(with_check, '') !~ 'has_permission|has_workspace_access|is_app_admin'
  ) then 'PASS' else 'FAIL' end;
