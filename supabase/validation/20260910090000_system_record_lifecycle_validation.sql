begin;
set transaction read only;

select table_name,
       bool_and(column_name in ('is_active', 'deactivated_at', 'deactivated_by_employee_id')) as lifecycle_columns_known,
       count(*) = 3 as lifecycle_column_count_ok
from information_schema.columns
where table_schema = 'public'
  and table_name in ('email_templates', 'system_metadata')
  and column_name in ('is_active', 'deactivated_at', 'deactivated_by_employee_id')
group by table_name
order by table_name;

select 'email_templates_consistent' as check_name,
       not exists (
         select 1 from public.email_templates
         where (is_active and (deactivated_at is not null or deactivated_by_employee_id is not null))
            or (not is_active and deactivated_at is null)
       ) as passed
union all
select 'system_metadata_consistent',
       not exists (
         select 1 from public.system_metadata
         where (is_active and (deactivated_at is not null or deactivated_by_employee_id is not null))
            or (not is_active and deactivated_at is null)
       );

select tablename, policyname, cmd, roles
from pg_policies
where schemaname = 'public'
  and tablename in ('email_templates', 'system_metadata')
order by tablename, policyname;

rollback;
