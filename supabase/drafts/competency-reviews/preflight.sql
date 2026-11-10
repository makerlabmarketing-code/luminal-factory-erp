select count(*) = 5 as required_employee_columns
from information_schema.columns
where table_schema='public' and table_name='employees'
  and column_name in ('id','full_name','role','status','is_active');

select to_regclass('public.competency_manager_drafts') is null
  and to_regclass('public.competency_self_reviews') is null
  and to_regclass('public.competency_publications') is null as clean_namespace;
