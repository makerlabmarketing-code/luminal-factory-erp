-- Disable PAYROLL_REOPEN_ENABLED first. Never discard used reopening history.
begin;
do $$begin
 if exists(select 1 from public.payroll_settlement_reopenings) or exists(select 1 from public.payroll_settlements group by employee_id,payroll_month having count(*)>1) then raise exception 'payroll_reopening_history_requires_forward_fix'; end if;
end $$;
CREATE OR REPLACE FUNCTION public.admin_attendance_mutation(p_operation text, p_attendance_id bigint, p_employee_id bigint, p_work_date date, p_shift_name text, p_check_in time without time zone, p_check_out time without time zone, p_reason text, p_correlation_id uuid)
 RETURNS SETOF attendance
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.create_payroll_adjustment(p_settlement_id uuid, p_amount numeric, p_reason text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$ declare actor bigint:=public.current_employee_id(); employee bigint; result uuid; stamp timestamptz:=clock_timestamp(); revision integer; begin
 if actor is null or not public.has_permission('PAYROLL_ADJUST') then raise exception 'payroll adjustment forbidden' using errcode='42501'; end if;
 if p_amount=0 or length(btrim(p_reason))<3 then raise exception 'invalid adjustment'; end if;
 select employee_id into employee from public.payroll_settlements where id=p_settlement_id; if employee is null then raise exception 'settlement not found'; end if;
 select coalesce(max(revision_number),0)+1 into revision from public.payroll_adjustments where settlement_id=p_settlement_id;
 insert into public.payroll_adjustments(settlement_id,revision_number,amount,reason,approved_by_employee_id,approved_at,created_at) values(p_settlement_id,revision,p_amount,btrim(p_reason),actor,stamp,stamp) returning id into result;
 insert into public.payroll_audit_history(event_type,settlement_id,employee_id,actor_employee_id,occurred_at,details) values('ADJUSTED',p_settlement_id,employee,actor,stamp,jsonb_build_object('adjustment_id',result,'amount',p_amount,'reason',btrim(p_reason))); return result;
end $function$;

CREATE OR REPLACE FUNCTION public.payroll_result(p_month date, p_employee_id bigint)
 RETURNS SETOF payroll_result_row
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
 select e.id,e.full_name,date_trunc('month',p_month)::date,coalesce(s.worked_minutes,c.worked_minutes),coalesce(s.worked_hours,c.worked_hours),coalesce(s.calculated_shifts,c.calculated_shifts),coalesce(s.hourly_rate,c.hourly_rate),coalesce(s.base_salary,c.base_salary),s.id,s.settled_at,
 coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'amount',a.amount,'reason',a.reason,'approved_at',a.approved_at) order by a.revision_number) from public.payroll_adjustments a where a.settlement_id=s.id),'[]'::jsonb),
 coalesce((select sum(a.amount) from public.payroll_adjustments a where a.settlement_id=s.id),0),coalesce(s.base_salary,c.base_salary)+coalesce((select sum(a.amount) from public.payroll_adjustments a where a.settlement_id=s.id),0)
 from public.employees e cross join lateral public.payroll_month_calculation(e.id,p_month)c left join public.payroll_settlements s on s.employee_id=e.id and s.payroll_month=date_trunc('month',p_month)::date where e.id=p_employee_id;
$function$;

CREATE OR REPLACE FUNCTION public.settle_monthly_payroll(p_employee_id bigint, p_month date)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$ declare actor bigint:=public.current_employee_id(); config_month date; calc record; result uuid; stamp timestamptz:=clock_timestamp(); begin
 if actor is null or not public.has_permission('PAYROLL_SETTLE') then raise exception 'payroll settlement forbidden' using errcode='42501'; end if;
 select first_settlement_month into config_month from public.payroll_configuration where singleton=true;
 if config_month is null then raise exception 'first settlement month is not configured'; end if;
 if p_month < config_month then raise exception 'historical settlement is not allowed'; end if;
 select * into calc from public.payroll_month_calculation(p_employee_id,p_month);
 insert into public.payroll_settlements(employee_id,payroll_month,worked_minutes,worked_hours,calculated_shifts,hourly_rate,base_salary,attendance_summary,settled_by_employee_id,settled_at,created_at)
 values(p_employee_id,p_month,calc.worked_minutes,calc.worked_hours,calc.calculated_shifts,calc.hourly_rate,calc.base_salary,calc.attendance_summary,actor,stamp,stamp) returning id into result;
 insert into public.payroll_audit_history(event_type,settlement_id,employee_id,actor_employee_id,occurred_at,details) values('SETTLED',result,p_employee_id,actor,stamp,jsonb_build_object('base_salary',calc.base_salary)); return result;
end $function$;

drop trigger payroll_snapshot_guard on public.payroll_settlements;
drop trigger payroll_snapshot_register on public.payroll_settlements;
drop trigger attendance_payroll_period_guard on public.attendance;
drop trigger salary_payroll_reopen_guard on public.financial_ledger;
drop trigger salary_email_payroll_reopen_guard on public.salary_payment_emails;
drop function public.reopen_monthly_payroll(uuid,text), public.guard_payroll_active_snapshot(), public.register_payroll_active_snapshot(), public.guard_attendance_payroll_period(), public.guard_reopened_salary_payment();
drop table public.payroll_active_settlements,public.payroll_settlement_reopenings;
drop index public.payroll_settlements_employee_month_idx;
alter table public.payroll_settlements add constraint payroll_settlements_employee_id_payroll_month_key unique(employee_id,payroll_month);
commit;
