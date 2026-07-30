\set ON_ERROR_STOP on
-- READ ONLY. Required psql variables: target_row_id, employee_id, actor_employee_id.
begin transaction read only;
select a.id, a.employee_id, a.work_date, a.check_in, a.check_out, a.status,
       a.total_hours, a.total_salary, a.cancellation_reason,
       a.cancelled_by_employee_id, a.cancelled_at
from public.attendance a
where a.id = :'target_row_id'::bigint and a.employee_id = :'employee_id'::bigint;

select id as cancellation_audit_id, attendance_id, employee_id, event_type,
       previous_status, resulting_status, reason, actor_employee_id, occurred_at, details
from public.attendance_cancellation_audit
where attendance_id = :'target_row_id'::bigint and employee_id = :'employee_id'::bigint
order by id;

select count(*) as target_still_open_count from public.attendance
where id = :'target_row_id'::bigint and employee_id = :'employee_id'::bigint
  and check_in is not null and check_out is null and cancelled_at is null;
select count(*) as finalized_settlement_reference_count
from public.payroll_settlements s cross join lateral jsonb_array_elements(s.attendance_summary) item
where s.employee_id = :'employee_id'::bigint and item ->> 'attendance_id' = :'target_row_id';
rollback;
