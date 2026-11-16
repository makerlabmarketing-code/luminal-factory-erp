-- READ-ONLY PREFLIGHT, no mutation.
-- Operator must compare actual RPC definition against reviewed baseline and verify the Production flag OFF.
select p.oid::regprocedure as rpc_signature, p.prosecdef as is_security_definer,
       pg_get_functiondef(p.oid) as current_source_for_operator_review
from pg_proc p
where p.oid = to_regprocedure('public.staff_attendance_multi_mutation(text)');

select count(*)::bigint as unresolved_old_shifts
from public.attendance
where cancelled_at is null and check_in is not null and check_out is null
  and work_date < (timezone('Asia/Ho_Chi_Minh', clock_timestamp()))::date;

select count(*)::bigint as employees_with_multiple_open_shifts
from (select employee_id from public.attendance
  where cancelled_at is null and check_in is not null and check_out is null
  group by employee_id having count(*) > 1) q;
-- Keep any employee-specific evidence private and outside the repository.
