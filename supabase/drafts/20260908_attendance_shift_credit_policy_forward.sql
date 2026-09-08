-- FORWARD PACKAGE — requires explicit production approval before migration delivery.
begin;

create or replace function public.attendance_shift_units(p_worked_minutes integer)
returns integer
language sql
immutable
security invoker
set search_path = ''
as $$
  select case
    when p_worked_minutes < 30 then 0
    else least(3, 1 + ((p_worked_minutes - 30) / 180))
  end;
$$;

revoke all on function public.attendance_shift_units(integer) from public, anon, authenticated;

create or replace function public.apply_attendance_credited_salary()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  actual_minutes integer;
  credited_shifts integer;
  hourly_rate numeric := 0;
begin
  if new.check_in is null or new.check_out is null then
    new.total_hours := null;
    new.total_salary := null;
    return new;
  end if;

  actual_minutes := greatest(0, floor(extract(epoch from (new.check_out - new.check_in)) / 60)::integer);
  credited_shifts := public.attendance_shift_units(actual_minutes);

  select coalesce(e.hourly_rate, 0)
  into hourly_rate
  from public.employees e
  where e.id = new.employee_id;

  new.total_hours := round(actual_minutes::numeric / 60, 2);
  new.total_salary := case
    when credited_shifts <= 0 or hourly_rate <= 0 then 0
    else round((credited_shifts * 3) * hourly_rate)
  end;

  return new;
end;
$$;

revoke all on function public.apply_attendance_credited_salary() from public, anon, authenticated;

drop trigger if exists attendance_credited_salary_before_write on public.attendance;
create trigger attendance_credited_salary_before_write
before insert or update of employee_id, check_in, check_out
on public.attendance
for each row
execute function public.apply_attendance_credited_salary();

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
    select id, actual_minutes, public.attendance_shift_units(actual_minutes) as shifts
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

revoke all on function public.payroll_month_calculation(bigint, date) from public, anon, authenticated;

do $$
declare
  sample_minutes integer[] := array[0, 29, 30, 209, 210, 389, 390, 900];
  expected_shifts integer[] := array[0, 0, 1, 1, 2, 2, 3, 3];
  i integer;
begin
  for i in 1..array_length(sample_minutes, 1) loop
    if public.attendance_shift_units(sample_minutes[i]) <> expected_shifts[i] then
      raise exception 'Attendance credited-shift policy validation failed for % minutes', sample_minutes[i];
    end if;
  end loop;
end $$;

comment on function public.attendance_shift_units(integer) is
  'Credits 0 shifts below 30 minutes, then one shift plus one per additional 180 minutes, capped at three.';

comment on function public.payroll_month_calculation(bigint, date) is
  'Payroll uses the approved 30-minute minimum and 210/390-minute shift boundaries; actual attendance hours remain unchanged.';

commit;
