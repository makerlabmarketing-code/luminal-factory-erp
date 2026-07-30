-- Repository/package validation. Read only; zero rows indicate PASS for each exception query.
select a.id as invalid_cancelled_row
from public.attendance a
where a.cancelled_at is not null and (
  a.check_out is not null or a.total_hours is not null or a.total_salary is not null
  or a.cancellation_reason is null or a.cancelled_by_employee_id is null or a.cancelled_at is null
);

select a.id as cancelled_row_in_payroll
from public.attendance a
join public.payroll_settlements s on s.employee_id = a.employee_id
cross join lateral jsonb_array_elements(s.attendance_summary) item
where a.cancelled_at is not null and item ->> 'attendance_id' = a.id::text;

select grantee, privilege_type as forbidden_mutation_grant
from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'attendance_cancellation_audit'
  and grantee in ('PUBLIC', 'anon', 'authenticated')
  and privilege_type <> 'SELECT';

select event_object_table, trigger_name
from information_schema.triggers
where event_object_schema = 'public'
  and event_object_table = 'attendance_cancellation_audit'
  and trigger_name = 'attendance_cancellation_audit_immutable';
