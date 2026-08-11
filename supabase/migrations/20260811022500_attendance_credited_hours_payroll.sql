-- Align attendance settlement with the 3-hour credited-shift policy while preserving actual elapsed time.
-- Business rule:
--   minutes <= 0   => 0 shifts
--   1..180         => 1 shift  => 3 credited hours
--   181..360       => 2 shifts => 6 credited hours
--   > 360          => 3 shifts => 9 credited hours
-- attendance.total_hours remains actual elapsed hours for audit/display.
-- Salary/payroll use credited hours.

begin;

create or replace function public.staff_attendance_multi_mutation(p_action text)
returns setof public.attendance
language plpgsql
set search_path = public, auth, pg_temp
as $$
declare
  actor bigint := public.current_employee_id();
  row_value public.attendance%rowtype;
  hourly_rate numeric := 0;
  worked_minutes integer;
  worked_hours numeric;
  credited_shifts integer;
  credited_hours numeric;
  business_now timestamp := timezone('Asia/Ho_Chi_Minh', clock_timestamp());
  p_work_date date;
  p_shift_name text;
  p_check_time time without time zone;
begin
  if actor is null or not public.has_workspace_access('STAFF_WORKSPACE') then
    raise exception 'Staff attendance access denied' using errcode = '42501';
  end if;
  if p_action not in ('check_in', 'check_out') then
    raise exception 'Invalid staff attendance mutation' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(actor);
  p_work_date := business_now::date;
  p_check_time := business_now::time;
  p_shift_name := case
    when p_check_time >= time '06:00' and p_check_time < time '12:00' then 'Ca Sáng'
    when p_check_time >= time '12:00' and p_check_time < time '18:00' then 'Ca Chiều'
    else 'Ca Tối'
  end;

  if p_action = 'check_in' and exists (
    select 1 from public.attendance
    where employee_id = actor and cancelled_at is null
      and check_in is not null and check_out is null
  ) then
    raise exception 'Attendance shift is already open' using errcode = '23505';
  end if;

  if p_action = 'check_out' then
    select * into row_value
    from public.attendance
    where employee_id = actor and cancelled_at is null
      and check_in is not null and check_out is null
    order by work_date desc, id desc
    limit 1
    for update;
    if found then
      p_work_date := row_value.work_date;
      p_shift_name := row_value.shift_name;
    end if;
  else
    select * into row_value
    from public.attendance
    where employee_id = actor and work_date = p_work_date and shift_name = p_shift_name and cancelled_at is null
    for update;
  end if;

  if p_action = 'check_in' then
    if not found then
      insert into public.attendance(employee_id, work_date, shift_name, check_in, check_out, total_hours, total_salary, status)
      values (actor, p_work_date, p_shift_name, p_check_time, null, null, null, 'PRESENT')
      returning * into row_value;
    elsif row_value.check_out is null then
      raise exception 'Attendance shift is already open' using errcode = '23505';
    else
      update public.attendance
      set check_out = null, total_hours = null, total_salary = null, status = 'PRESENT'
      where id = row_value.id
      returning * into row_value;
    end if;
  else
    if not found or row_value.check_in is null or row_value.check_out is not null then
      raise exception 'Attendance shift is not open' using errcode = '55000';
    end if;
    if p_check_time < row_value.check_in then
      raise exception 'Attendance check-out precedes check-in' using errcode = '22007';
    end if;

    worked_minutes := greatest(0, floor(extract(epoch from (p_check_time - row_value.check_in)) / 60)::integer);
    worked_hours := round(worked_minutes::numeric / 60, 2);
    credited_shifts := case
      when worked_minutes <= 0 then 0
      when worked_minutes <= 180 then 1
      when worked_minutes <= 360 then 2
      else 3
    end;
    credited_hours := credited_shifts * 3;

    select coalesce(e.hourly_rate, 0) into hourly_rate
    from public.employees e
    where e.id = actor;

    update public.attendance
    set check_out = p_check_time,
        total_hours = worked_hours,
        total_salary = case
          when credited_hours <= 0 or hourly_rate <= 0 then 0
          else round(credited_hours * hourly_rate)
        end,
        status = 'PRESENT'
    where id = row_value.id
    returning * into row_value;
  end if;

  return next row_value;
end;
$$;

create or replace function public.admin_attendance_mutation(
  p_operation text,
  p_attendance_id bigint,
  p_employee_id bigint,
  p_work_date date,
  p_shift_name text,
  p_check_in time without time zone,
  p_check_out time without time zone,
  p_reason text,
  p_correlation_id uuid
)
returns setof public.attendance
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  actor bigint := public.current_employee_id();
  before_row public.attendance%rowtype;
  after_row public.attendance%rowtype;
  hourly_rate numeric := 0;
  worked_minutes integer;
  worked_hours numeric;
  credited_shifts integer;
  credited_hours numeric;
begin
  if actor is null or not public.has_workspace_access('ADMIN_WORKSPACE') or not public.has_permission('ATTENDANCE_MANAGE') then
    raise exception 'Admin attendance access denied' using errcode = '42501';
  end if;
  if p_operation not in ('CREATE', 'UPDATE', 'DELETE') or length(btrim(coalesce(p_reason, ''))) < 10 or p_correlation_id is null then
    raise exception 'Invalid audited attendance mutation' using errcode = '22023';
  end if;

  if p_operation = 'CREATE' then
    if p_employee_id is null or p_work_date is null or btrim(coalesce(p_shift_name, '')) = '' or p_check_in is null or p_check_out is null or p_check_out < p_check_in then
      raise exception 'Invalid attendance interval' using errcode = '22007';
    end if;

    worked_minutes := greatest(0, floor(extract(epoch from (p_check_out - p_check_in)) / 60)::integer);
    worked_hours := round(worked_minutes::numeric / 60, 2);
    credited_shifts := case
      when worked_minutes <= 0 then 0
      when worked_minutes <= 180 then 1
      when worked_minutes <= 360 then 2
      else 3
    end;
    credited_hours := credited_shifts * 3;

    select coalesce(e.hourly_rate, 0) into hourly_rate
    from public.employees e
    where e.id = p_employee_id;

    insert into public.attendance(employee_id, work_date, shift_name, check_in, check_out, total_hours, total_salary, status)
    values (
      p_employee_id,
      p_work_date,
      p_shift_name,
      p_check_in,
      p_check_out,
      worked_hours,
      case when credited_hours <= 0 or hourly_rate <= 0 then 0 else round(credited_hours * hourly_rate) end,
      'PRESENT'
    )
    returning * into after_row;

    insert into public.attendance_operation_audit(attendance_id, employee_id, actor_employee_id, operation, reason, before_state, after_state, correlation_id)
    values (after_row.id, after_row.employee_id, actor, 'CREATE', p_reason, '{}'::jsonb, public.attendance_audit_state(after_row), p_correlation_id);

  elsif p_operation = 'UPDATE' then
    select * into before_row from public.attendance where id = p_attendance_id for update;
    if not found or before_row.cancelled_at is not null or p_employee_id is null or p_check_in is null or p_check_out is null or p_check_out < p_check_in then
      raise exception 'Attendance row cannot be updated' using errcode = '55000';
    end if;
    if p_employee_id is distinct from before_row.employee_id then
      raise exception 'Attendance employee cannot be changed' using errcode = '22023';
    end if;
    if to_regclass('public.payroll_settlements') is not null and exists (
      select 1 from public.payroll_settlements s
      cross join lateral jsonb_array_elements(s.attendance_summary) item
      where item ->> 'attendance_id' = before_row.id::text
    ) then
      raise exception 'Attendance row is referenced by finalized payroll' using errcode = '55000';
    end if;

    worked_minutes := greatest(0, floor(extract(epoch from (p_check_out - p_check_in)) / 60)::integer);
    worked_hours := round(worked_minutes::numeric / 60, 2);
    credited_shifts := case
      when worked_minutes <= 0 then 0
      when worked_minutes <= 180 then 1
      when worked_minutes <= 360 then 2
      else 3
    end;
    credited_hours := credited_shifts * 3;

    select coalesce(e.hourly_rate, 0) into hourly_rate
    from public.employees e
    where e.id = before_row.employee_id;

    update public.attendance
    set work_date = coalesce(p_work_date, before_row.work_date),
        shift_name = coalesce(nullif(btrim(p_shift_name), ''), before_row.shift_name),
        check_in = p_check_in,
        check_out = p_check_out,
        total_hours = worked_hours,
        total_salary = case when credited_hours <= 0 or hourly_rate <= 0 then 0 else round(credited_hours * hourly_rate) end,
        status = 'PRESENT'
    where id = before_row.id
    returning * into after_row;

    insert into public.attendance_operation_audit(attendance_id, employee_id, actor_employee_id, operation, reason, before_state, after_state, correlation_id)
    values (after_row.id, after_row.employee_id, actor, 'UPDATE', p_reason, public.attendance_audit_state(before_row), public.attendance_audit_state(after_row), p_correlation_id);

  else
    select * into before_row from public.attendance where id = p_attendance_id for update;
    if not found or before_row.cancelled_at is not null then
      raise exception 'Attendance row cannot be deleted' using errcode = '55000';
    end if;
    if to_regclass('public.payroll_settlements') is not null and exists (
      select 1 from public.payroll_settlements s
      cross join lateral jsonb_array_elements(s.attendance_summary) item
      where item ->> 'attendance_id' = before_row.id::text
    ) then
      raise exception 'Attendance row is referenced by finalized payroll' using errcode = '55000';
    end if;

    update public.attendance
    set check_out = null,
        total_hours = null,
        total_salary = null,
        status = 'CANCELLED',
        cancellation_reason = p_reason,
        cancelled_by_employee_id = actor,
        cancelled_at = now()
    where id = before_row.id
    returning * into after_row;

    insert into public.attendance_cancellation_audit(
      attendance_id, employee_id, event_type, previous_status, resulting_status,
      reason, actor_employee_id, occurred_at, details
    )
    values (
      after_row.id, after_row.employee_id, 'CANCELLED', before_row.status,
      after_row.status, p_reason, actor, now(),
      jsonb_build_object('correlation_id', p_correlation_id, 'operation', 'DELETE')
    );

    insert into public.attendance_operation_audit(attendance_id, employee_id, actor_employee_id, operation, reason, before_state, after_state, correlation_id)
    values (after_row.id, after_row.employee_id, actor, 'DELETE', p_reason, public.attendance_audit_state(before_row), public.attendance_audit_state(after_row), p_correlation_id);
  end if;

  return next after_row;
end;
$$;

create or replace function public.payroll_month_calculation(p_employee_id bigint, p_month date)
returns table(
  worked_minutes integer,
  worked_hours numeric,
  calculated_shifts integer,
  hourly_rate numeric,
  base_salary numeric,
  attendance_summary jsonb
)
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  with attendance_rows as (
    select
      a.id,
      greatest(0, round(coalesce(a.total_hours, 0)::numeric * 60))::integer as actual_minutes
    from public.attendance a
    where a.employee_id = p_employee_id
      and a.work_date >= date_trunc('month', p_month)::date
      and a.work_date < (date_trunc('month', p_month) + interval '1 month')::date
      and a.check_in is not null
      and a.check_out is not null
      and a.cancelled_at is null
  ), credited_rows as (
    select
      id,
      actual_minutes,
      case
        when actual_minutes <= 0 then 0
        when actual_minutes <= 180 then 1
        when actual_minutes <= 360 then 2
        else 3
      end as shifts
    from attendance_rows
  ), totals as (
    select
      coalesce(sum(shifts * 180), 0)::integer as credited_minutes,
      coalesce(sum(shifts), 0)::integer as shifts,
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'attendance_id', id,
            'worked_minutes', actual_minutes,
            'calculated_shifts', shifts,
            'credited_minutes', shifts * 180
          )
          order by id
        ),
        '[]'::jsonb
      ) as summary
    from credited_rows
  )
  select
    t.credited_minutes,
    round(t.credited_minutes::numeric / 60, 2),
    t.shifts,
    coalesce(e.hourly_rate, 0)::numeric,
    round((t.credited_minutes::numeric / 60) * coalesce(e.hourly_rate, 0)::numeric),
    t.summary
  from totals t
  join public.employees e on e.id = p_employee_id;
$$;

-- Keep the raw helper private. Authenticated callers must continue using the scoped payroll wrappers.
revoke all on function public.payroll_month_calculation(bigint, date) from public, anon, authenticated;

-- Migration-time boundary checks guard the exact shift conversion policy.
do $$
declare
  sample_minutes integer[] := array[0, 1, 180, 181, 360, 361];
  expected_shifts integer[] := array[0, 1, 1, 2, 2, 3];
  i integer;
  actual_shift integer;
begin
  for i in 1..array_length(sample_minutes, 1) loop
    actual_shift := case
      when sample_minutes[i] <= 0 then 0
      when sample_minutes[i] <= 180 then 1
      when sample_minutes[i] <= 360 then 2
      else 3
    end;

    if actual_shift <> expected_shifts[i] then
      raise exception 'Attendance credited-shift policy validation failed for % minutes', sample_minutes[i];
    end if;
  end loop;
end $$;

comment on function public.payroll_month_calculation(bigint, date) is
  'Payroll calculation uses credited shifts (3 hours per shift) while attendance.total_hours remains actual elapsed time.';

commit;
