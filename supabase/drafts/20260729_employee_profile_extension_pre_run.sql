-- READ ONLY. Do not execute without operator approval.
begin;
select to_regclass('public.employees') as employees_table,
       to_regprocedure('public.current_employee_id()') as current_employee_helper,
       to_regprocedure('public.has_workspace_access(text)') as workspace_helper,
       to_regprocedure('public.has_permission(text)') as permission_helper;
select column_name, data_type from information_schema.columns
 where table_schema='public' and table_name='employees'
   and column_name in ('birth_date','gender','address','avatar_url','personal_notes','employment_type','employment_start_date','manager_employee_id');
select to_regclass('public.employee_audit_events') as existing_audit_table;
rollback;
