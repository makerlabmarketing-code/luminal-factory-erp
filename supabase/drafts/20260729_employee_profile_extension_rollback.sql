-- DESTRUCTIVE rollback. Operator approval required. Audit rows are lost.
begin;
drop trigger if exists employees_capture_safe_audit on public.employees;
drop function if exists public.capture_employee_safe_audit();
drop table if exists public.employee_audit_events;
drop index if exists public.employees_manager_employee_id_idx;
alter table public.employees
 drop column if exists manager_employee_id,
 drop column if exists employment_start_date,
 drop column if exists employment_type,
 drop column if exists personal_notes,
 drop column if exists avatar_url,
 drop column if exists address,
 drop column if exists gender,
 drop column if exists birth_date;
commit;
