-- ROLLBACK — does not mutate attendance or immutable payroll settlement rows.
begin;

drop trigger if exists attendance_credited_salary_before_write on public.attendance;
drop function if exists public.apply_attendance_credited_salary();

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
    select a.id, greatest(0, round(coalesce(a.total_hours, 0)::numeric * 60))::integer as actual_minutes
    from public.attendance a
    where a.employee_id = p_employee_id
      and a.work_date >= date_trunc('month', p_month)::date
      and a.work_date < (date_trunc('month', p_month) + interval '1 month')::date
      and a.check_in is not null
      and a.check_out is not null
      and a.cancelled_at is null
  ), credited_rows as (
    select id, actual_minutes, case
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
      coalesce(jsonb_agg(jsonb_build_object('attendance_id', id, 'worked_minutes', actual_minutes, 'calculated_shifts', shifts, 'credited_minutes', shifts * 180) order by id), '[]'::jsonb) as summary
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
drop function if exists public.attendance_shift_units(integer);

commit;
