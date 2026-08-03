-- READ-ONLY preflight. Do not execute from Codex against production.
select to_regclass('public.attendance') as attendance_table,
       to_regclass('public.employees') as employees_table,
       to_regclass('public.payroll_settlements') as payroll_settlements_table,
       to_regprocedure('public.current_employee_id()') as current_employee_function,
       to_regprocedure('public.has_workspace_access(text)') as workspace_function,
       to_regprocedure('public.has_permission(text)') as permission_function;

select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'attendance'
  and column_name in (
    'employee_id', 'work_date', 'shift_name', 'check_in', 'check_out',
    'total_hours', 'total_salary', 'status', 'cancelled_at',
    'cancellation_reason', 'cancelled_by_employee_id'
  )
order by ordinal_position;

select employee_id, work_date, shift_name, count(*)::integer as active_row_count
from public.attendance
where cancelled_at is null
group by employee_id, work_date, shift_name
having count(*) > 1
order by active_row_count desc, employee_id, work_date, shift_name;

select count(*)::bigint as attendance_rows,
       count(*) filter (where cancelled_at is null)::bigint as active_rows,
       count(*) filter (where check_in is not null and check_out is null)::bigint as open_rows
from public.attendance;

select to_regclass('public.attendance_operation_audit') as audit_table,
       to_regclass('public.attendance_cancellation_audit') as cancellation_audit_table,
       to_regclass('public.attendance_employee_date_shift_active_idx') as active_unique_index,
       to_regprocedure('public.staff_attendance_multi_mutation(text,date,text,time without time zone)') as staff_rpc,
       to_regprocedure('public.admin_attendance_mutation(text,bigint,bigint,date,text,time without time zone,time without time zone,text,uuid)') as admin_rpc;
