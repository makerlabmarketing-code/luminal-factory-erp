-- Disable reopening first; rollback refuses used adjusted reopening history.
begin;
do $$ begin if exists(select 1 from public.payroll_settlement_reopenings r join public.payroll_adjustments a on a.settlement_id=r.settlement_id) then raise exception 'adjusted_reopening_requires_forward_fix'; end if; end $$;
create or replace function public.reopen_monthly_payroll(p_settlement_id uuid,p_reason text) returns void language plpgsql security definer set search_path=public,auth,pg_temp as $$
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

commit;
