\set ON_ERROR_STOP on
-- MUTATING OPERATOR ROLLBACK. Requires target_row_id, employee_id, actor_employee_id,
-- cancellation_audit_id, rollback_reason. It never deletes immutable audit history.
begin;
select set_config('luminal.target_row_id', :'target_row_id', true);
select set_config('luminal.employee_id', :'employee_id', true);
select set_config('luminal.actor_employee_id', :'actor_employee_id', true);
select set_config('luminal.cancellation_audit_id', :'cancellation_audit_id', true);
select set_config('luminal.rollback_reason', :'rollback_reason', true);

do $$
declare
  target_id bigint := current_setting('luminal.target_row_id')::bigint;
  employee bigint := current_setting('luminal.employee_id')::bigint;
  actor bigint := current_setting('luminal.actor_employee_id')::bigint;
  cancellation_id bigint := current_setting('luminal.cancellation_audit_id')::bigint;
  rollback_reason text := btrim(current_setting('luminal.rollback_reason'));
  original_status text;
  original_total_hours numeric;
  original_total_salary numeric;
  changed_count integer;
  stamp timestamptz := clock_timestamp();
begin
  if length(rollback_reason) < 10 then raise exception 'Rollback reason must contain at least 10 characters'; end if;
  if not exists (select 1 from public.employees e where e.id = actor and e.status = 'ACTIVE' and coalesce(e.is_active, true)) then
    raise exception 'Rollback operator actor is missing or inactive';
  end if;
  select previous_status,
         (details ->> 'previous_total_hours')::numeric,
         (details ->> 'previous_total_salary')::numeric
  into original_status, original_total_hours, original_total_salary
  from public.attendance_cancellation_audit
  where id = cancellation_id and attendance_id = target_id and employee_id = employee
    and event_type = 'CANCELLED'
    and details ? 'previous_total_hours'
    and details ? 'previous_total_salary';
  if not found then raise exception 'Exact cancellation audit event not found'; end if;
  if exists (select 1 from public.attendance_cancellation_audit where cancellation_event_id = cancellation_id) then
    raise exception 'Cancellation event was already rolled back';
  end if;
  if not exists (select 1 from public.attendance where id = target_id and employee_id = employee
      and work_date = date '2026-05-21' and check_in is not null and check_out is null
      and cancelled_by_employee_id is not null and cancelled_at is not null) then
    raise exception 'Target is not in the exact cancelled state';
  end if;

  update public.attendance set cancellation_reason = null,
    cancelled_by_employee_id = null, cancelled_at = null,
    total_hours = original_total_hours,
    total_salary = original_total_salary
  where id = target_id and employee_id = employee and cancelled_at is not null;
  get diagnostics changed_count = row_count;
  if changed_count <> 1 then raise exception 'Rollback changed % rows instead of one', changed_count; end if;

  insert into public.attendance_cancellation_audit
    (attendance_id, employee_id, event_type, previous_status, resulting_status,
     reason, actor_employee_id, occurred_at, cancellation_event_id, details)
  values (target_id, employee, 'ROLLBACK_RESTORED', original_status, original_status,
          rollback_reason, actor, stamp, cancellation_id, jsonb_build_object(
            'work_date', '2026-05-21',
            'restored_total_hours', original_total_hours,
            'restored_total_salary', original_total_salary
          ));
end $$;
commit;
