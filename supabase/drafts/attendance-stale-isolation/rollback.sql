-- OPERATOR ROLLBACK ONLY. Disable ATTENDANCE_STALE_ISOLATION_ENABLED before running.
-- Restores previous all-date guard, including the current credited-shift salary calculation.
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
commit;
