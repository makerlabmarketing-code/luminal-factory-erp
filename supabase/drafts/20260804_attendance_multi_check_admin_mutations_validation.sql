-- READ-ONLY post-run validation. Do not execute without explicit approval.
select indexname, indexdef
from pg_indexes
where schemaname = 'public' and indexname = 'attendance_employee_date_shift_active_idx';

select to_regclass('public.attendance_operation_audit') as audit_table,
       to_regprocedure('public.staff_attendance_multi_mutation(text,date,text,time without time zone)') as staff_rpc,
       to_regprocedure('public.admin_attendance_mutation(text,bigint,bigint,date,text,time without time zone,time without time zone,text,uuid)') as admin_rpc;

select polname, cmd
from pg_policies
where schemaname = 'public' and tablename = 'attendance_operation_audit';

select employee_id, work_date, shift_name, count(*)::integer as active_row_count
from public.attendance
where cancelled_at is null
group by employee_id, work_date, shift_name
having count(*) > 1;

select operation, count(*)::bigint as audit_count
from public.attendance_operation_audit
group by operation
order by operation;
