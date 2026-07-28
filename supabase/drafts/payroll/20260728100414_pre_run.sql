-- Read-only. Every row must return PASS/zero before migration delivery.
select to_regclass('public.employees') is not null as employees_present, to_regclass('public.attendance') is not null as attendance_present;
select to_regprocedure('public.current_employee_id()') is not null as current_employee_helper_present, to_regprocedure('public.has_permission(text)') is not null as permission_helper_present;
select count(*) as existing_payroll_package_tables from pg_class where relnamespace='public'::regnamespace and relname in ('payroll_configuration','payroll_settlements','payroll_adjustments','payroll_audit_history');
select count(*) as invalid_attendance_hours from public.attendance where total_hours < 0;
select count(*) as invalid_active_employee_rates from public.employees where status='ACTIVE' and coalesce(is_active,true) and (hourly_rate is null or hourly_rate < 0);
