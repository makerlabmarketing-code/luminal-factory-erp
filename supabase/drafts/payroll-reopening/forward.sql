-- DRAFT: requires approval of this exact package before production.
begin;
create table public.payroll_active_settlements (
 employee_id bigint not null references public.employees(id),
 payroll_month date not null,
 settlement_id uuid not null unique references public.payroll_settlements(id),
 primary key(employee_id,payroll_month)
);
create table public.payroll_settlement_reopenings (
 settlement_id uuid primary key references public.payroll_settlements(id),
 actor_employee_id bigint not null references public.employees(id),
 reason text not null check(length(btrim(reason)) between 10 and 1000),
 reopened_at timestamptz not null default clock_timestamp()
);
alter table public.payroll_active_settlements enable row level security;
alter table public.payroll_settlement_reopenings enable row level security;
revoke all on public.payroll_active_settlements,public.payroll_settlement_reopenings from public,anon,authenticated,service_role;
grant select on public.payroll_active_settlements,public.payroll_settlement_reopenings to service_role;
-- Metadata only: original snapshots and payroll amounts are untouched.
insert into public.payroll_active_settlements select employee_id,payroll_month,id from public.payroll_settlements;
alter table public.payroll_settlements drop constraint payroll_settlements_employee_id_payroll_month_key;
create index payroll_settlements_employee_month_idx on public.payroll_settlements(employee_id,payroll_month);
create trigger payroll_reopenings_immutable before update or delete on public.payroll_settlement_reopenings for each row execute function public.block_immutable_payroll_change();

create function public.guard_payroll_active_snapshot() returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
 perform 1 from public.employees where id=new.employee_id for update;
 if exists(select 1 from public.payroll_active_settlements where employee_id=new.employee_id and payroll_month=new.payroll_month) then raise exception 'already settled' using errcode='23505'; end if;
 return new;
end $$;
create trigger payroll_snapshot_guard before insert on public.payroll_settlements for each row execute function public.guard_payroll_active_snapshot();
create function public.register_payroll_active_snapshot() returns trigger language plpgsql set search_path=public,pg_temp as $$
begin insert into public.payroll_active_settlements values(new.employee_id,new.payroll_month,new.id); return new; end $$;
create trigger payroll_snapshot_register after insert on public.payroll_settlements for each row execute function public.register_payroll_active_snapshot();

create function public.guard_attendance_payroll_period() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 -- Existing UPDATE paths may lock an attendance row first; deadlocks abort one
 -- transaction rather than allowing a payroll/attendance race to commit.
 if tg_op <> 'INSERT' then
   perform 1 from public.employees where id=old.employee_id for update;
   if exists(select 1 from public.payroll_active_settlements where employee_id=old.employee_id and payroll_month=date_trunc('month',old.work_date)::date) then raise exception 'payroll_period_closed' using errcode='55000'; end if;
 end if;
 if tg_op <> 'DELETE' then
   perform 1 from public.employees where id=new.employee_id for update;
   if exists(select 1 from public.payroll_active_settlements where employee_id=new.employee_id and payroll_month=date_trunc('month',new.work_date)::date) then raise exception 'payroll_period_closed' using errcode='55000'; end if;
   return new;
 end if;
 return old;
end $$;
create trigger attendance_payroll_period_guard before insert or update or delete on public.attendance for each row execute function public.guard_attendance_payroll_period();

create function public.reopen_monthly_payroll(p_settlement_id uuid,p_reason text) returns void language plpgsql security definer set search_path=public,auth,pg_temp as $$
declare actor bigint:=public.current_employee_id(); snapshot public.payroll_settlements%rowtype;
begin
 if actor is null or not public.has_workspace_access('ADMIN_WORKSPACE') or not public.has_permission('PAYROLL_SETTLE') then raise exception 'payroll reopen forbidden' using errcode='42501'; end if;
 if p_reason is null or length(btrim(p_reason)) not between 10 and 1000 then raise exception 'invalid reopen reason' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended('payroll-reopen-salary-payment',0));
 select * into snapshot from public.payroll_settlements where id=p_settlement_id;
 if not found then raise exception 'settlement not found'; end if;
 perform 1 from public.employees where id=snapshot.employee_id for update;
 if not exists(select 1 from public.payroll_active_settlements where settlement_id=p_settlement_id) then raise exception 'payroll_snapshot_stale'; end if;
 if exists(select 1 from public.payroll_adjustments where settlement_id=p_settlement_id) then raise exception 'payroll_has_adjustments'; end if;
 -- Conservative matching covers old manual salary ledgers as well as linked ones.
 if exists(select 1 from public.salary_payment_emails where employee_id=snapshot.employee_id and salary_month=snapshot.payroll_month)
 or exists(select 1 from public.financial_ledger where (coalesce(is_paid,false) or payment_status='PAID')
   and (source_reference=p_settlement_id::text or ((beneficiary_employee_id=snapshot.employee_id or beneficiary_employee_id is null) and (month_period=to_char(snapshot.payroll_month,'MM/YYYY') or month_period is null or month_period !~ '^(0[1-9]|1[0-2])/[0-9]{4}$')
   and type in ('CHI_PHI','CHI_TIEU') and (source_type in ('PAYROLL','SALARY') or coalesce(category,'') ~* '^Lương([[:space:]]|$)')))) then raise exception 'payroll_already_paid'; end if;
 insert into public.payroll_settlement_reopenings(settlement_id,actor_employee_id,reason) values(p_settlement_id,actor,btrim(p_reason));
 delete from public.payroll_active_settlements where settlement_id=p_settlement_id;
end $$;
revoke all on function public.reopen_monthly_payroll(uuid,text) from public,anon;
grant execute on function public.reopen_monthly_payroll(uuid,text) to authenticated;

create function public.guard_reopened_salary_payment() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare employee bigint; salary_month date; source text;
begin
 if tg_table_name='salary_payment_emails' then employee:=new.employee_id; salary_month:=new.salary_month;
 else
   if not (coalesce(new.is_paid,false) or new.payment_status='PAID') or new.type not in ('CHI_PHI','CHI_TIEU') or not (coalesce(new.source_type,'') in ('PAYROLL','SALARY') or coalesce(new.category,'') ~* '^Lương([[:space:]]|$)') then return new; end if;
   employee:=new.beneficiary_employee_id; source:=new.source_reference;
   if new.month_period ~ '^(0[1-9]|1[0-2])/[0-9]{4}$' then salary_month:=to_date(new.month_period,'MM/YYYY'); end if;
 end if;
 perform pg_advisory_xact_lock(hashtextextended('payroll-reopen-salary-payment',0));
 perform 1 from public.employees where id=employee for update;
 if exists(select 1 from public.payroll_settlement_reopenings where settlement_id::text=source) then raise exception 'payroll_snapshot_stale'; end if;
 if exists(select 1 from public.payroll_settlements where employee_id=employee and payroll_month=salary_month)
 and not exists(select 1 from public.payroll_active_settlements where employee_id=employee and payroll_month=salary_month) then raise exception 'payroll_period_reopened'; end if;
 return new;
end $$;
create trigger salary_payroll_reopen_guard before insert or update on public.financial_ledger for each row execute function public.guard_reopened_salary_payment();
create trigger salary_email_payroll_reopen_guard before insert on public.salary_payment_emails for each row execute function public.guard_reopened_salary_payment();
revoke all on function public.guard_payroll_active_snapshot(), public.register_payroll_active_snapshot(), public.guard_attendance_payroll_period(), public.guard_reopened_salary_payment() from public,anon,authenticated;

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
 if p_month is null or p_month<>date_trunc('month',p_month)::date then raise exception 'invalid payroll month'; end if;
 if not public.has_workspace_access('ADMIN_WORKSPACE') then raise exception 'payroll settlement forbidden' using errcode='42501'; end if;
 perform 1 from public.employees where id=p_employee_id for update;
 if not found then raise exception 'employee not found'; end if;
 if exists(select 1 from public.attendance where employee_id=p_employee_id and work_date>=p_month and work_date<(p_month+interval '1 month')::date and cancelled_at is null and check_in is not null and check_out is null) then raise exception 'payroll_unfinished_attendance'; end if;
 select * into calc from public.payroll_month_calculation(p_employee_id,p_month);
 insert into public.payroll_settlements(employee_id,payroll_month,worked_minutes,worked_hours,calculated_shifts,hourly_rate,base_salary,attendance_summary,settled_by_employee_id,settled_at,created_at)
 values(p_employee_id,p_month,calc.worked_minutes,calc.worked_hours,calc.calculated_shifts,calc.hourly_rate,calc.base_salary,calc.attendance_summary,actor,stamp,stamp) returning id into result;
 insert into public.payroll_audit_history(event_type,settlement_id,employee_id,actor_employee_id,occurred_at,details) values('SETTLED',result,p_employee_id,actor,stamp,jsonb_build_object('base_salary',calc.base_salary)); return result;
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
 from public.employees e cross join lateral public.payroll_month_calculation(e.id,p_month)c left join public.payroll_active_settlements active on active.employee_id=e.id and active.payroll_month=date_trunc('month',p_month)::date left join public.payroll_settlements s on s.id=active.settlement_id where e.id=p_employee_id;
$function$;

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
      join public.payroll_active_settlements active on active.settlement_id=s.id
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
      join public.payroll_active_settlements active on active.settlement_id=s.id
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
 if p_amount is null or p_amount::text in ('NaN','Infinity','-Infinity') or p_amount=0 or p_amount<>trunc(p_amount) or abs(p_amount)>999999999999 or p_reason is null or length(btrim(p_reason)) not between 3 and 1000 then raise exception 'invalid adjustment'; end if;
 select employee_id into employee from public.payroll_settlements where id=p_settlement_id; if employee is null then raise exception 'settlement not found'; end if;
 perform 1 from public.employees where id=employee for update;
 if not exists(select 1 from public.payroll_active_settlements where settlement_id=p_settlement_id) then raise exception 'payroll_snapshot_stale'; end if;
 select coalesce(max(revision_number),0)+1 into revision from public.payroll_adjustments where settlement_id=p_settlement_id;
 insert into public.payroll_adjustments(settlement_id,revision_number,amount,reason,approved_by_employee_id,approved_at,created_at) values(p_settlement_id,revision,p_amount,btrim(p_reason),actor,stamp,stamp) returning id into result;
 insert into public.payroll_audit_history(event_type,settlement_id,employee_id,actor_employee_id,occurred_at,details) values('ADJUSTED',p_settlement_id,employee,actor,stamp,jsonb_build_object('adjustment_id',result,'amount',p_amount,'reason',btrim(p_reason))); return result;
end $function$;

commit;
