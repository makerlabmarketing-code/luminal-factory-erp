-- READ-ONLY POST-DEPLOY VALIDATION, no mutation.
-- Both date-scoped predicates must exist before enabling the application flag.
with rpc as (
  select pg_get_functiondef(to_regprocedure('public.staff_attendance_multi_mutation(text)')) as definition
)
select (select to_regprocedure('public.staff_attendance_multi_mutation(text)') is not null) as rpc_exists,
       (select count(*)::int from regexp_matches(definition, 'and work_date = p_work_date', 'g')) >= 2
         as date_guards_exist,
       definition like '%pg_advisory_xact_lock(actor)%' as employee_lock_retained,
       definition like '%has_workspace_access%' as staff_permission_retained,
       definition like '%credited_hours := credited_shifts * 3%' as credited_hours_policy_retained
from rpc;

select grantee, privilege_type
from information_schema.routine_privileges
where specific_schema = 'public' and routine_name = 'staff_attendance_multi_mutation'
order by grantee, privilege_type;
