\set ON_ERROR_STOP on
-- READ ONLY. Required psql variables: target_row_id, employee_id, actor_employee_id.
begin transaction read only;

select
  a.id,
  a.employee_id,
  a.work_date,
  a.check_in,
  a.check_out,
  a.total_hours,
  a.total_salary,
  a.status,
  a.cancellation_reason,
  a.cancelled_by_employee_id,
  a.cancelled_at
from public.attendance a
where a.id = :'target_row_id'::bigint
  and a.employee_id = :'employee_id'::bigint;

select count(*) as exact_target_count
from public.attendance a
where a.id = :'target_row_id'::bigint
  and a.employee_id = :'employee_id'::bigint
  and a.work_date = date '2026-05-21'
  and a.check_in is not null
  and a.check_out is null
  and (a.total_hours is null or a.total_hours = 0)
  and (a.total_salary is null or a.total_salary = 0)
  and a.cancelled_at is null;

select count(*) as employee_open_row_count
from public.attendance a
where a.employee_id = :'employee_id'::bigint
  and a.check_in is not null
  and a.check_out is null
  and a.cancelled_at is null;

select count(*) as finalized_settlement_reference_count
from public.payroll_settlements s
cross join lateral jsonb_array_elements(s.attendance_summary) item
where s.employee_id = :'employee_id'::bigint
  and item ->> 'attendance_id' = :'target_row_id';

select e.id as actor_employee_id, e.status as actor_status,
       coalesce(e.is_active, true) as actor_is_active,
       exists (select 1 from public.employee_workspace_access w
               where w.employee_id = e.id and w.workspace = 'ADMIN_WORKSPACE'
                 and w.status = 'ACTIVE' and w.revoked_at is null) as actor_has_admin_workspace,
       exists (select 1 from public.employee_permissions p
               where p.employee_id = e.id and p.permission_code = 'ATTENDANCE_MANAGE'
                 and p.effect = 'ALLOW' and p.status = 'ACTIVE' and p.revoked_at is null)
       and not exists (select 1 from public.employee_permissions p
               where p.employee_id = e.id and p.permission_code = 'ATTENDANCE_MANAGE'
                 and p.effect = 'DENY' and p.status = 'ACTIVE' and p.revoked_at is null)
         as actor_has_attendance_manage
from public.employees e
where e.id = :'actor_employee_id'::bigint;

select grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name = 'attendance_cancellation_audit'
  and grantee in ('PUBLIC', 'anon', 'authenticated')
order by grantee, privilege_type;

rollback;
