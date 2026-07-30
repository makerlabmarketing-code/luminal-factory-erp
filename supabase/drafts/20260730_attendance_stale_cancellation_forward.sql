\set ON_ERROR_STOP on
-- MUTATING OPERATOR SCRIPT. Requires target_row_id, employee_id, actor_employee_id, reason.
begin;
select set_config('luminal.target_row_id', :'target_row_id', true);
select set_config('luminal.employee_id', :'employee_id', true);
select set_config('luminal.actor_employee_id', :'actor_employee_id', true);
select set_config('luminal.cancellation_reason', :'reason', true);

do $$
declare
  target_id bigint := current_setting('luminal.target_row_id')::bigint;
  employee bigint := current_setting('luminal.employee_id')::bigint;
  actor bigint := current_setting('luminal.actor_employee_id')::bigint;
  reason_text text := btrim(current_setting('luminal.cancellation_reason'));
  stamp timestamptz := clock_timestamp();
  target_count integer;
  open_count integer;
  settlement_count integer;
  changed_count integer;
  old_status text;
  old_total_hours numeric;
  old_total_salary numeric;
begin
  if length(reason_text) < 10 then raise exception 'Cancellation reason must contain at least 10 characters'; end if;
  if not exists (select 1 from public.employees e where e.id = actor and e.status = 'ACTIVE' and coalesce(e.is_active, true)) then
    raise exception 'Operator actor is missing or inactive';
  end if;

  if not exists (select 1 from public.employee_workspace_access w where w.employee_id = actor and w.workspace = 'ADMIN_WORKSPACE' and w.status = 'ACTIVE' and w.revoked_at is null)
    or not exists (select 1 from public.employee_permissions p where p.employee_id = actor and p.permission_code = 'ATTENDANCE_MANAGE' and p.effect = 'ALLOW' and p.status = 'ACTIVE' and p.revoked_at is null)
    or exists (select 1 from public.employee_permissions p where p.employee_id = actor and p.permission_code = 'ATTENDANCE_MANAGE' and p.effect = 'DENY' and p.status = 'ACTIVE' and p.revoked_at is null) then
    raise exception 'Operator actor lacks effective Attendance management authorization';
  end if;

  perform 1 from public.attendance a where a.employee_id = employee for update;
  select count(*), min(a.status), min(a.total_hours), min(a.total_salary)
  into target_count, old_status, old_total_hours, old_total_salary
  from public.attendance a
  where a.id = target_id and a.employee_id = employee
    and a.work_date = date '2026-05-21'
    and a.check_in is not null and a.check_out is null
    and (a.total_hours is null or a.total_hours = 0)
    and (a.total_salary is null or a.total_salary = 0)
    and a.cancelled_at is null;
  if target_count <> 1 then raise exception 'Expected exactly one still-open zero-contribution 2026-05-21 target row; found %', target_count; end if;

  select count(*) into open_count from public.attendance a
  where a.employee_id = employee and a.check_in is not null and a.check_out is null
    and a.cancelled_at is null;
  if open_count <> 1 then raise exception 'Expected target to be the employee''s only open row; found %', open_count; end if;

  select count(*) into settlement_count
  from public.payroll_settlements s
  cross join lateral jsonb_array_elements(s.attendance_summary) item
  where s.employee_id = employee and item ->> 'attendance_id' = target_id::text;
  if settlement_count <> 0 then raise exception 'Attendance row is referenced by % finalized payroll settlement item(s)', settlement_count; end if;

  update public.attendance
  set cancellation_reason = reason_text,
      cancelled_by_employee_id = actor,
      cancelled_at = stamp,
      total_hours = null,
      total_salary = null
  where id = target_id and employee_id = employee and work_date = date '2026-05-21'
    and check_in is not null and check_out is null
    and (total_hours is null or total_hours = 0)
    and (total_salary is null or total_salary = 0)
    and cancelled_at is null;
  get diagnostics changed_count = row_count;
  if changed_count <> 1 then raise exception 'Cancellation changed % rows instead of one', changed_count; end if;

  insert into public.attendance_cancellation_audit
    (attendance_id, employee_id, event_type, previous_status, resulting_status,
     reason, actor_employee_id, occurred_at, details)
  values
    (target_id, employee, 'CANCELLED', old_status, old_status, reason_text,
     actor, stamp, jsonb_build_object(
       'work_date', '2026-05-21',
       'checkout_invented', false,
       'previous_total_hours', old_total_hours,
       'previous_total_salary', old_total_salary
     ));
end $$;
commit;
