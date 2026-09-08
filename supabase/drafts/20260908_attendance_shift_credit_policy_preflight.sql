-- READ-ONLY PREFLIGHT — RUN BEFORE FORWARD SQL
select
  to_regclass('public.attendance') is not null as attendance_ready,
  to_regprocedure('public.payroll_month_calculation(bigint,date)') is not null as payroll_calculation_ready,
  to_regprocedure('public.staff_attendance_multi_mutation(text)') is not null as staff_mutation_ready,
  to_regprocedure('public.admin_attendance_mutation(text,bigint,bigint,date,text,time without time zone,time without time zone,text,uuid)') is not null as admin_mutation_ready;

select count(*) as immutable_settlements_preserved
from public.payroll_settlements;
