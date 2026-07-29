-- READ ONLY verification after approved delivery.
select column_name, data_type, is_nullable from information_schema.columns
 where table_schema='public' and table_name='employees'
   and column_name in ('birth_date','gender','address','avatar_url','personal_notes','employment_type','employment_start_date','manager_employee_id') order by column_name;
select relrowsecurity from pg_class where oid='public.employee_audit_events'::regclass;
select policyname, cmd, roles from pg_policies where schemaname='public' and tablename='employee_audit_events';
select tgname from pg_trigger where tgrelid='public.employees'::regclass and not tgisinternal and tgname='employees_capture_safe_audit';
