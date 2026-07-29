-- READ ONLY validation. Returns zero rows on a complete approved deployment.
with required(name) as (values ('birth_date'),('gender'),('address'),('avatar_url'),('personal_notes'),('employment_type'),('employment_start_date'),('manager_employee_id'))
select name as missing_column from required r where not exists (
 select 1 from information_schema.columns c where c.table_schema='public' and c.table_name='employees' and c.column_name=r.name
);
select 'missing_audit_table' as validation_failure where to_regclass('public.employee_audit_events') is null;
select 'missing_audit_rls' as validation_failure where exists (
 select 1 from pg_class where oid=to_regclass('public.employee_audit_events') and not relrowsecurity
);
select 'missing_audit_trigger' as validation_failure where not exists (
 select 1 from pg_trigger where tgrelid='public.employees'::regclass and not tgisinternal and tgname='employees_capture_safe_audit'
);
