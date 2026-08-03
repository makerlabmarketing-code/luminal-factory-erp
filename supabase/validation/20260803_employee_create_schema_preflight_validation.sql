-- READ ONLY. Interpretive validation for the Employee create schema preflight.
-- PASS means the named repository assumption is visible; it does not approve a retry or mutation.
begin transaction read only;

with expected(column_name) as (
  values ('full_name'), ('email'), ('title'), ('phone'), ('branch_code'),
         ('status'), ('role'), ('is_active'), ('auth_user_id')
), actual as (
  select column_name
  from information_schema.columns
  where table_schema = 'public' and table_name = 'employees'
)
select 'insert_columns_present' as check_name,
       case when count(*) filter (where actual.column_name is null) = 0 then 'PASS' else 'FAIL' end as result,
       coalesce(string_agg(expected.column_name, ', ' order by expected.column_name)
         filter (where actual.column_name is null), 'none') as missing_columns
from expected left join actual using (column_name);

select 'unsupplied_required_columns' as check_name,
       case when count(*) = 0 then 'PASS' else 'REVIEW_REQUIRED' end as result,
       coalesce(string_agg(column_name, ', ' order by ordinal_position), 'none') as columns
from information_schema.columns
where table_schema = 'public' and table_name = 'employees'
  and is_nullable = 'NO'
  and column_default is null
  and is_identity = 'NO'
  and is_generated = 'NEVER'
  and column_name not in (
    'full_name', 'email', 'title', 'phone', 'branch_code', 'status',
    'role', 'is_active', 'auth_user_id'
  );

select 'fixture_state' as check_name,
       case
         when exists(select 1 from public.employees where lower(btrim(to_jsonb(employees) ->> 'email')) = 'makerlab.marketing@gmail.com')
           then 'DUPLICATE_REVIEW_REQUIRED'
         when exists(select 1 from public.facilities where to_jsonb(facilities) ->> 'code' = 'X_NG_CH_NH_LUMINAL')
           then 'PASS'
         else 'FACILITY_REVIEW_REQUIRED'
       end as result,
       exists(select 1 from public.facilities where to_jsonb(facilities) ->> 'code' = 'X_NG_CH_NH_LUMINAL') as branch_code_exists,
       exists(select 1 from public.employees where lower(btrim(to_jsonb(employees) ->> 'email')) = 'makerlab.marketing@gmail.com') as normalized_email_exists;

select 'employee_rls_enabled' as check_name,
       case when c.relrowsecurity then 'PASS' else 'REVIEW_REQUIRED' end as result
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'employees';

rollback;
