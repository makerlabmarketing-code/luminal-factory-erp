-- Read-only preflight and validation for 20260723120000_facility_status_code.sql.

-- Preflight: must return zero rows before production apply.
with proposed_codes as (
  select
    id,
    upper(
      regexp_replace(
        coalesce(
          nullif(trim(to_jsonb(facility_row)->>'code'), ''),
          nullif(trim(facility_name), ''),
          'FACILITY-' || id::text
        ),
        '[^A-Za-z0-9]+',
        '_',
        'g'
      )
    ) as proposed_code
  from public.facilities facility_row
)
select proposed_code, count(*) as duplicate_count
from proposed_codes
group by proposed_code
having count(*) > 1;

-- Post-apply validation.
select
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'facilities'
      and column_name = 'code'
      and is_nullable = 'NO'
  ) as facilities_code_not_null,
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'facilities'
      and column_name = 'is_active'
  ) as facilities_is_active_present,
  to_regclass('public.facilities_code_unique_idx') is not null
    as facilities_code_unique_idx_present,
  to_regclass('public.facilities_active_idx') is not null
    as facilities_active_idx_present;
