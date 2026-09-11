begin;
set transaction read only;

select table_name, count(*) as row_count
from (
  select 'email_templates'::text as table_name from public.email_templates
  union all
  select 'system_metadata'::text from public.system_metadata
) rows
group by table_name
order by table_name;

select tc.table_name, kcu.column_name, ccu.table_name as referenced_table
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu
  on tc.constraint_name = kcu.constraint_name and tc.constraint_schema = kcu.constraint_schema
join information_schema.constraint_column_usage ccu
  on ccu.constraint_name = tc.constraint_name and ccu.constraint_schema = tc.constraint_schema
where tc.constraint_type = 'FOREIGN KEY'
  and (tc.table_name in ('email_templates', 'system_metadata')
    or ccu.table_name in ('email_templates', 'system_metadata'));

rollback;
