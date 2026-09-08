-- READ-ONLY POST-FORWARD VALIDATION
select
  public.attendance_shift_units(0) = 0 as zero_minutes,
  public.attendance_shift_units(29) = 0 as below_minimum,
  public.attendance_shift_units(30) = 1 as minimum_one_shift,
  public.attendance_shift_units(209) = 1 as below_second_shift,
  public.attendance_shift_units(210) = 2 as second_shift_boundary,
  public.attendance_shift_units(389) = 2 as below_third_shift,
  public.attendance_shift_units(390) = 3 as third_shift_boundary,
  public.attendance_shift_units(900) = 3 as capped_at_three;

select
  to_regprocedure('public.attendance_shift_units(integer)') is not null as shift_function_ready,
  to_regprocedure('public.apply_attendance_credited_salary()') is not null as salary_trigger_function_ready,
  exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.attendance'::regclass
      and tgname = 'attendance_credited_salary_before_write'
      and not tgisinternal
  ) as salary_trigger_ready;

select count(*) as immutable_settlements_preserved
from public.payroll_settlements;
