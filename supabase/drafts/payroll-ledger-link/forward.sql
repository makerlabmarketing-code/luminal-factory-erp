-- DRAFT ONLY: not an approved Production migration. Zero business-row backfill.
begin;
do $$begin
 if exists(select 1 from pg_depend d where d.refclassid='pg_proc'::regclass and d.deptype in ('n','a') and d.refobjid in (
  'public.settle_monthly_payroll(bigint,date)'::regprocedure,'public.create_payroll_adjustment(uuid,numeric,text)'::regprocedure,
  'public.reopen_monthly_payroll(uuid,text)'::regprocedure,'public.confirm_salary_ledger_payment(bigint,date,bigint)'::regprocedure)) then
  raise exception 'payroll_link_dependency_review_required';
 end if;
 if exists(select 1 from public.financial_ledger where idempotency_key like 'payroll-ledger:%' or idempotency_key like 'payroll-supplement:%' or source_type='PAYROLL_SUPPLEMENT') then
  raise exception 'payroll_link_reserved_marker_collision';
 end if;
end $$;
create schema payroll_link_private;
revoke all on schema payroll_link_private from public, anon, authenticated, service_role;
create table payroll_link_private.configuration (
 singleton boolean primary key default true check(singleton),
 mode text not null default 'OFF' check(mode in ('OFF','ON','PAUSED'))
);
insert into payroll_link_private.configuration values(true,'OFF');
create table public.payroll_ledger_links (
 settlement_id uuid primary key references public.payroll_settlements(id) on delete restrict,
 ledger_id bigint not null unique references public.financial_ledger(id) on delete restrict,
 state text not null default 'ACTIVE' check(state in ('ACTIVE','SUPERSEDED')),
 created_by_employee_id bigint not null references public.employees(id),
 created_at timestamptz not null default clock_timestamp()
);
alter table public.payroll_ledger_links enable row level security;
revoke all on public.payroll_ledger_links from public,anon,authenticated,service_role;
grant select on public.payroll_ledger_links to service_role;
create table public.payroll_supplemental_obligations (
 id uuid primary key,
 settlement_id uuid not null references public.payroll_settlements(id) on delete restrict,
 ledger_id bigint not null unique references public.financial_ledger(id) on delete restrict,
 amount numeric not null check(amount>0 and amount::text not in ('NaN','Infinity','-Infinity')),
 reason text not null check(length(btrim(reason)) between 3 and 1000),
 created_by_employee_id bigint not null references public.employees(id),
 created_at timestamptz not null default clock_timestamp()
);
alter table public.payroll_supplemental_obligations enable row level security;
revoke all on public.payroll_supplemental_obligations from public,anon,authenticated,service_role;
grant select on public.payroll_supplemental_obligations to service_role;
create trigger payroll_supplements_immutable before update or delete on public.payroll_supplemental_obligations
 for each row execute function public.block_immutable_payroll_change();
create table payroll_link_private.write_permits (
 transaction_id bigint primary key,
 settlement_id uuid not null,
 ledger_id bigint,
 operation text not null check(operation in ('CREATE','ADJUST','REOPEN','PAY'))
);
alter table payroll_link_private.configuration enable row level security;
alter table payroll_link_private.write_permits enable row level security;
revoke all on all tables in schema payroll_link_private from public,anon,authenticated,service_role;

-- Preserve the exact deployed implementations and their OIDs for guarded rollback.
alter function public.settle_monthly_payroll(bigint,date) set schema payroll_link_private;
alter function public.create_payroll_adjustment(uuid,numeric,text) set schema payroll_link_private;
alter function public.reopen_monthly_payroll(uuid,text) set schema payroll_link_private;
alter function public.confirm_salary_ledger_payment(bigint,date,bigint) set schema payroll_link_private;
revoke all on all functions in schema payroll_link_private from public,anon,authenticated,service_role;

create function payroll_link_private.enabled() returns boolean language plpgsql security invoker set search_path='' as $$
declare mode_value text;
begin
 select mode into strict mode_value from payroll_link_private.configuration where singleton;
 if mode_value='ON' then return true; end if;
 if mode_value='PAUSED' or exists(select 1 from public.payroll_ledger_links) then
  raise exception 'payroll_link_maintenance' using errcode='55000';
 end if;
 return false;
end $$;

create function payroll_link_private.guard_ledger() returns trigger language plpgsql security definer set search_path='' as $$
declare permit payroll_link_private.write_permits%rowtype; linked boolean;
begin
 if tg_op<>'DELETE' and new.type in ('CHI_PHI','CHI_TIEU') and (new.source_type in ('PAYROLL','SALARY') or coalesce(new.category,'') ~* '^Lương([[:space:]]|$)') then
  perform pg_advisory_xact_lock(hashtextextended('payroll-reopen-salary-payment',0));
 end if;
 if tg_op<>'DELETE' and coalesce(new.idempotency_key,'') not like 'payroll-ledger:%' and new.source_type is distinct from 'PAYROLL_SUPPLEMENT' and new.type in ('CHI_PHI','CHI_TIEU') and (new.source_type in ('PAYROLL','SALARY') or coalesce(new.category,'') ~* '^Lương([[:space:]]|$)')
 and exists(select 1 from public.payroll_ledger_links k join public.payroll_settlements s on s.id=k.settlement_id where k.state='ACTIVE' and k.ledger_id<>new.id
  and (new.beneficiary_employee_id=s.employee_id or new.beneficiary_employee_id is null)
  and (new.month_period in (to_char(s.payroll_month,'MM/YYYY'),to_char(s.payroll_month+interval '1 month','MM/YYYY')) or new.month_period is null or new.month_period !~ '^(0[1-9]|1[0-2])/[0-9]{4}$')) then
   raise exception 'payroll_link_legacy_reconciliation' using errcode='55000';
 end if;
 if tg_op='INSERT' then
  if new.source_type='PAYROLL_SUPPLEMENT' then
   if new.source_reference is null or new.idempotency_key is distinct from 'payroll-supplement:'||new.source_reference then raise exception 'payroll_link_source_protected' using errcode='42501'; end if;
  elsif new.source_type is distinct from 'PAYROLL' or new.source_reference is null
     or new.idempotency_key is distinct from 'payroll-ledger:'||new.source_reference then
   if new.idempotency_key like 'payroll-ledger:%' or new.idempotency_key like 'payroll-supplement:%' then
    raise exception 'payroll_link_source_protected' using errcode='42501';
   end if;
   return new;
  end if;
 else
  select exists(select 1 from public.payroll_ledger_links where ledger_id=old.id)
   or exists(select 1 from public.payroll_supplemental_obligations where ledger_id=old.id) into linked;
  if not linked then
   if tg_op<>'DELETE' and (new.idempotency_key like 'payroll-ledger:%' or new.idempotency_key like 'payroll-supplement:%' or new.source_type='PAYROLL_SUPPLEMENT') then
    raise exception 'payroll_link_source_protected' using errcode='42501';
   end if;
   return case when tg_op='DELETE' then old else new end;
  end if;
  if tg_op='DELETE' then raise exception 'payroll_link_source_protected' using errcode='42501'; end if;
 end if;
 select * into permit from payroll_link_private.write_permits where transaction_id=txid_current();
 if not found then raise exception 'payroll_link_source_protected' using errcode='42501'; end if;
 if tg_op='INSERT' then
  if permit.operation<>'CREATE' or permit.settlement_id::text is distinct from new.source_reference or permit.ledger_id is not null then
   raise exception 'payroll_link_source_protected' using errcode='42501';
  end if;
 elsif permit.ledger_id is distinct from old.id then raise exception 'payroll_link_source_protected' using errcode='42501';
 elsif permit.operation='ADJUST' then
  if exists(select 1 from public.payroll_supplemental_obligations where ledger_id=old.id) then raise exception 'payroll_link_source_protected' using errcode='42501'; end if;
  if (to_jsonb(new)-array['amount','updated_at']) is distinct from (to_jsonb(old)-array['amount','updated_at']) then raise exception 'payroll_link_source_protected' using errcode='42501'; end if;
 elsif permit.operation='REOPEN' then
  if exists(select 1 from public.payroll_supplemental_obligations where ledger_id=old.id) then raise exception 'payroll_link_source_protected' using errcode='42501'; end if;
  if (to_jsonb(new)-array['cancelled_at','updated_at']) is distinct from (to_jsonb(old)-array['cancelled_at','updated_at']) then raise exception 'payroll_link_source_protected' using errcode='42501'; end if;
 elsif permit.operation='PAY' then
  if (to_jsonb(new)-array['is_paid','payment_status','paid_at','payment_confirmer_employee_id','updated_at']) is distinct from (to_jsonb(old)-array['is_paid','payment_status','paid_at','payment_confirmer_employee_id','updated_at']) then raise exception 'payroll_link_source_protected' using errcode='42501'; end if;
 else raise exception 'payroll_link_source_protected' using errcode='42501';
 end if;
 return new;
end $$;
create trigger payroll_link_ledger_guard before insert or update or delete on public.financial_ledger for each row execute function payroll_link_private.guard_ledger();

create function payroll_link_private.payable(p_settlement_id uuid) returns numeric language sql stable security invoker set search_path='' as $$
 select s.base_salary+coalesce((select sum(a.amount) from public.payroll_adjustments a join public.payroll_settlements origin on origin.id=a.settlement_id where origin.employee_id=s.employee_id and origin.payroll_month=s.payroll_month),0)
 from public.payroll_settlements s where s.id=p_settlement_id
$$;
create function payroll_link_private.audit(p_ledger_id bigint,p_event text,p_actor bigint,p_reason text,p_details jsonb) returns void language sql security invoker set search_path='' as $$
 insert into public.finance_ledger_history(financial_ledger_id,event_type,to_status,actor_employee_id,reason,idempotency_key,details)
 values(p_ledger_id,p_event,case when p_event='CANCELLED' then 'CANCELLED' else 'UNPAID' end,p_actor,p_reason,'payroll-link:'||gen_random_uuid()::text,p_details)
$$;

create function public.settle_monthly_payroll(p_employee_id bigint,p_month date) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid; ledger bigint; amount_value numeric; actor bigint:=public.current_employee_id(); integrated boolean;
begin
 if actor is null or not public.has_workspace_access('ADMIN_WORKSPACE') or not public.has_permission('PAYROLL_SETTLE') then raise exception 'payroll settlement forbidden' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended('payroll-reopen-salary-payment',0));
 integrated:=payroll_link_private.enabled();
 if exists(select 1 from public.payroll_active_settlements where employee_id=p_employee_id and payroll_month=p_month) then
  return payroll_link_private.settle_monthly_payroll(p_employee_id,p_month);
 end if;
 if integrated and (exists(select 1 from public.salary_payment_emails where employee_id=p_employee_id and salary_month=p_month)
 or exists(select 1 from public.financial_ledger l where l.cancelled_at is null and coalesce(l.idempotency_key,'') not like 'payroll-ledger:%' and l.source_type is distinct from 'PAYROLL_SUPPLEMENT' and l.type in ('CHI_PHI','CHI_TIEU') and (l.source_type in ('PAYROLL','SALARY') or coalesce(l.category,'') ~* '^Lương([[:space:]]|$)')
 and (l.beneficiary_employee_id=p_employee_id or l.beneficiary_employee_id is null) and (l.month_period in (to_char(p_month,'MM/YYYY'),to_char(p_month+interval '1 month','MM/YYYY')) or l.month_period is null or l.month_period !~ '^(0[1-9]|1[0-2])/[0-9]{4}$'))) then
  raise exception 'payroll_link_legacy_reconciliation' using errcode='55000';
 end if;
 result:=payroll_link_private.settle_monthly_payroll(p_employee_id,p_month);
 if not integrated then return result; end if;
 amount_value:=payroll_link_private.payable(result);
 if amount_value is null or amount_value<0 or amount_value::text in ('NaN','Infinity','-Infinity') then raise exception 'payroll_link_negative_payable' using errcode='22023'; end if;
 insert into payroll_link_private.write_permits values(txid_current(),result,null,'CREATE');
 insert into public.financial_ledger(type,category,amount,requested_by,month_period,is_paid,payment_status,beneficiary_employee_id,creator_employee_id,source_type,source_reference,idempotency_key,transaction_date,description,updated_at)
 select 'CHI_PHI','Lương',amount_value,null,to_char(p_month+interval '1 month','MM/YYYY'),false,'UNPAID',p_employee_id,actor,'PAYROLL',result::text,'payroll-ledger:'||result::text,(p_month+interval '1 month 9 days')::date,'Phiếu từ quyết toán lương',clock_timestamp() from public.employees e where e.id=actor returning id into ledger;
 insert into public.payroll_ledger_links(settlement_id,ledger_id,created_by_employee_id) values(result,ledger,actor);
 perform payroll_link_private.audit(ledger,'CREATED',actor,'Tạo từ quyết toán lương',jsonb_build_object('settlement_id',result,'amount',amount_value));
 delete from payroll_link_private.write_permits where transaction_id=txid_current();
 return result;
end $$;

create function public.create_payroll_adjustment(p_settlement_id uuid,p_amount numeric,p_reason text) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid; link public.payroll_ledger_links%rowtype; ledger public.financial_ledger%rowtype; amount_value numeric; actor bigint:=public.current_employee_id();
begin
 if actor is null or not public.has_workspace_access('ADMIN_WORKSPACE') or not public.has_permission('PAYROLL_ADJUST') then raise exception 'payroll adjustment forbidden' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended('payroll-reopen-salary-payment',0));
 if not payroll_link_private.enabled() then return payroll_link_private.create_payroll_adjustment(p_settlement_id,p_amount,p_reason); end if;
 select * into link from public.payroll_ledger_links where settlement_id=p_settlement_id and state='ACTIVE';
 if not found then raise exception 'payroll_link_legacy_reconciliation' using errcode='55000'; end if;
 select * into strict ledger from public.financial_ledger where id=link.ledger_id for update;
 if coalesce(ledger.is_paid,false) or ledger.payment_status='PAID' or ledger.cancelled_at is not null then raise exception 'payroll_already_paid' using errcode='55000'; end if;
 result:=payroll_link_private.create_payroll_adjustment(p_settlement_id,p_amount,p_reason);
 amount_value:=payroll_link_private.payable(p_settlement_id);
 if amount_value is null or amount_value<0 or amount_value::text in ('NaN','Infinity','-Infinity') then raise exception 'payroll_link_negative_payable' using errcode='22023'; end if;
 insert into payroll_link_private.write_permits values(txid_current(),p_settlement_id,ledger.id,'ADJUST');
 update public.financial_ledger set amount=amount_value,updated_at=clock_timestamp() where id=ledger.id;
 perform payroll_link_private.audit(ledger.id,'APPROVED',actor,p_reason,jsonb_build_object('adjustment_id',result,'before_amount',ledger.amount,'amount',amount_value));
 delete from payroll_link_private.write_permits where transaction_id=txid_current();
 return result;
end $$;

create function public.reopen_monthly_payroll(p_settlement_id uuid,p_reason text) returns void language plpgsql security definer set search_path='' as $$
declare link public.payroll_ledger_links%rowtype; snapshot public.payroll_settlements%rowtype; actor bigint:=public.current_employee_id();
begin
 if actor is null or not public.has_workspace_access('ADMIN_WORKSPACE') or not public.has_permission('PAYROLL_SETTLE') then raise exception 'payroll reopen forbidden' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended('payroll-reopen-salary-payment',0));
 if not payroll_link_private.enabled() then perform payroll_link_private.reopen_monthly_payroll(p_settlement_id,p_reason); return; end if;
 select * into link from public.payroll_ledger_links where settlement_id=p_settlement_id and state='ACTIVE';
 if not found then raise exception 'payroll_link_legacy_reconciliation' using errcode='55000'; end if;
 if p_reason is null or length(btrim(p_reason)) not between 10 and 1000 then raise exception 'invalid reopen reason' using errcode='22023'; end if;
 select * into strict snapshot from public.payroll_settlements where id=p_settlement_id;
 perform 1 from public.employees where id=snapshot.employee_id for update;
 if not exists(select 1 from public.payroll_active_settlements where settlement_id=p_settlement_id) then raise exception 'payroll_snapshot_stale'; end if;
 if exists(select 1 from public.financial_ledger where id=link.ledger_id and (coalesce(is_paid,false) or payment_status='PAID'))
 or exists(select 1 from public.salary_payment_emails where employee_id=snapshot.employee_id and salary_month=snapshot.payroll_month) then
  raise exception 'payroll_already_paid';
 end if;
 insert into public.payroll_settlement_reopenings(settlement_id,actor_employee_id,reason) values(p_settlement_id,actor,btrim(p_reason));
 delete from public.payroll_active_settlements where settlement_id=p_settlement_id;
 insert into payroll_link_private.write_permits values(txid_current(),p_settlement_id,link.ledger_id,'REOPEN');
 update public.financial_ledger set cancelled_at=clock_timestamp(),updated_at=clock_timestamp() where id=link.ledger_id;
 update public.payroll_ledger_links set state='SUPERSEDED' where settlement_id=p_settlement_id;
 perform payroll_link_private.audit(link.ledger_id,'CANCELLED',actor,p_reason,jsonb_build_object('settlement_id',p_settlement_id));
 delete from payroll_link_private.write_permits where transaction_id=txid_current();
end $$;

-- Service-only payment API: actor is supplied by the existing verified server boundary.
-- Definer is required to access the private permit and exact original implementation.
create function public.confirm_salary_ledger_payment(p_ledger_id bigint,p_salary_month date,p_actor_id bigint) returns uuid language plpgsql security definer set search_path='' as $$
declare link public.payroll_ledger_links%rowtype; supplement public.payroll_supplemental_obligations%rowtype; snapshot public.payroll_settlements%rowtype; ledger public.financial_ledger%rowtype; result uuid; integrated boolean;
begin
 perform pg_advisory_xact_lock(hashtextextended('payroll-reopen-salary-payment',0));
 select * into link from public.payroll_ledger_links where ledger_id=p_ledger_id;
 if not found then
  select * into supplement from public.payroll_supplemental_obligations where ledger_id=p_ledger_id;
  if not found then return payroll_link_private.confirm_salary_ledger_payment(p_ledger_id,p_salary_month,p_actor_id); end if;
  if not payroll_link_private.enabled() then raise exception 'payroll_link_maintenance' using errcode='55000'; end if;
  select * into strict snapshot from public.payroll_settlements where id=supplement.settlement_id;
  select * into strict ledger from public.financial_ledger where id=p_ledger_id for update;
  if snapshot.payroll_month is distinct from p_salary_month or ledger.amount is distinct from supplement.amount
   or ledger.beneficiary_employee_id is distinct from snapshot.employee_id or ledger.month_period is distinct from to_char(snapshot.payroll_month+interval '1 month','MM/YYYY')
   or ledger.source_type is distinct from 'PAYROLL_SUPPLEMENT' or ledger.source_reference is distinct from supplement.id::text
   or ledger.idempotency_key is distinct from 'payroll-supplement:'||supplement.id::text or ledger.cancelled_at is not null
   or not exists(select 1 from public.payroll_ledger_links k join public.financial_ledger original on original.id=k.ledger_id
    where k.settlement_id=snapshot.id and k.state='ACTIVE' and original.is_paid and original.payment_status='PAID'
     and exists(select 1 from public.payroll_active_settlements where settlement_id=snapshot.id)) then
   raise exception 'payroll_link_payment_conflict' using errcode='22023';
  end if;
  insert into payroll_link_private.write_permits values(txid_current(),supplement.id,p_ledger_id,'PAY');
  result:=payroll_link_private.confirm_salary_ledger_payment(p_ledger_id,p_salary_month,p_actor_id);
  delete from payroll_link_private.write_permits where transaction_id=txid_current();
  return result;
 end if;
 integrated:=payroll_link_private.enabled();
 if not integrated then raise exception 'payroll_link_maintenance' using errcode='55000'; end if;
 select * into strict snapshot from public.payroll_settlements where id=link.settlement_id;
 select * into strict ledger from public.financial_ledger where id=p_ledger_id for update;
 if link.state<>'ACTIVE' or not exists(select 1 from public.payroll_active_settlements where settlement_id=link.settlement_id)
 or snapshot.payroll_month is distinct from p_salary_month or ledger.beneficiary_employee_id is distinct from snapshot.employee_id
 or ledger.month_period is distinct from to_char(snapshot.payroll_month+interval '1 month','MM/YYYY')
 or ledger.cancelled_at is not null or ledger.amount<=0 or ledger.amount is distinct from payroll_link_private.payable(link.settlement_id) then
  raise exception 'payroll_link_payment_conflict' using errcode='22023';
 end if;
 insert into payroll_link_private.write_permits values(txid_current(),link.settlement_id,p_ledger_id,'PAY');
 result:=payroll_link_private.confirm_salary_ledger_payment(p_ledger_id,p_salary_month,p_actor_id);
 delete from payroll_link_private.write_permits where transaction_id=txid_current();
 return result;
end $$;

-- A paid base remains immutable. Each additional positive amount is a separate
-- source obligation and a separate payment/email; it is never added to base due.
create function public.create_payroll_supplement(p_settlement_id uuid,p_amount numeric,p_reason text,p_request_id uuid) returns bigint
language plpgsql security definer set search_path='' as $$
declare actor bigint:=public.current_employee_id(); snapshot public.payroll_settlements%rowtype; previous public.payroll_supplemental_obligations%rowtype; result bigint;
begin
 if actor is null or not public.has_workspace_access('ADMIN_WORKSPACE') or not public.has_permission('PAYROLL_ADJUST') then raise exception 'payroll supplement forbidden' using errcode='42501'; end if;
 if p_request_id is null or p_amount is null or p_amount<=0 or p_amount<>trunc(p_amount) or p_amount>999999999999
  or p_amount::text in ('NaN','Infinity','-Infinity') or p_reason is null or length(btrim(p_reason)) not between 3 and 1000 then
  raise exception 'payroll_supplement_invalid' using errcode='22023';
 end if;
 perform pg_advisory_xact_lock(hashtextextended('payroll-reopen-salary-payment',0));
 if not payroll_link_private.enabled() then raise exception 'payroll_supplement_not_enabled' using errcode='55000'; end if;
 select * into previous from public.payroll_supplemental_obligations where id=p_request_id;
 if found then
  if previous.settlement_id is distinct from p_settlement_id or previous.amount is distinct from p_amount
   or previous.reason is distinct from btrim(p_reason) or previous.created_by_employee_id is distinct from actor then
   raise exception 'payroll_supplement_request_conflict' using errcode='22023';
  end if;
  return previous.ledger_id;
 end if;
 select * into snapshot from public.payroll_settlements where id=p_settlement_id;
 if not found or not exists(select 1 from public.payroll_active_settlements where settlement_id=p_settlement_id)
  or not exists(select 1 from public.payroll_ledger_links k join public.financial_ledger l on l.id=k.ledger_id
   where k.settlement_id=p_settlement_id and k.state='ACTIVE' and l.is_paid and l.payment_status='PAID' and l.cancelled_at is null) then
  raise exception 'payroll_supplement_requires_paid_base' using errcode='55000';
 end if;
 insert into payroll_link_private.write_permits values(txid_current(),p_request_id,null,'CREATE');
 insert into public.financial_ledger(type,category,amount,requested_by,month_period,is_paid,payment_status,beneficiary_employee_id,creator_employee_id,source_type,source_reference,idempotency_key,transaction_date,description,updated_at)
 values('CHI_PHI','Lương bổ sung',p_amount,null,to_char(snapshot.payroll_month+interval '1 month','MM/YYYY'),false,'UNPAID',snapshot.employee_id,actor,
 'PAYROLL_SUPPLEMENT',p_request_id::text,'payroll-supplement:'||p_request_id::text,(snapshot.payroll_month+interval '1 month 9 days')::date,btrim(p_reason),clock_timestamp()) returning id into result;
 insert into public.payroll_supplemental_obligations(id,settlement_id,ledger_id,amount,reason,created_by_employee_id)
 values(p_request_id,p_settlement_id,result,p_amount,btrim(p_reason),actor);
 perform payroll_link_private.audit(result,'CREATED',actor,btrim(p_reason),jsonb_build_object('settlement_id',p_settlement_id,'supplement_id',p_request_id,'amount',p_amount));
 delete from payroll_link_private.write_permits where transaction_id=txid_current();
 return result;
end $$;

-- Operator-only reconciliation, never an exposed application RPC. Exact expected
-- identity and amount are required; it neither settles again nor confirms payment.
create function payroll_link_private.reconcile_unlinked(p_settlement_id uuid,p_employee_id bigint,p_month date,p_amount numeric,p_actor_id bigint) returns bigint
language plpgsql security invoker set search_path='' as $$
declare snapshot public.payroll_settlements%rowtype; linked public.payroll_ledger_links%rowtype; ledger public.financial_ledger%rowtype; result bigint;
begin
 perform pg_advisory_xact_lock(hashtextextended('payroll-reopen-salary-payment',0));
 select * into snapshot from public.payroll_settlements where id=p_settlement_id;
 if not found or snapshot.employee_id is distinct from p_employee_id or snapshot.payroll_month is distinct from p_month
 or p_amount is null or p_amount<0 or p_amount::text in ('NaN','Infinity','-Infinity')
 or payroll_link_private.payable(p_settlement_id) is distinct from p_amount
 or not exists(select 1 from public.payroll_active_settlements where settlement_id=p_settlement_id)
 or not exists(select 1 from public.employees where id=p_actor_id and is_active and status='ACTIVE') then
  raise exception 'payroll_link_reconciliation_mismatch' using errcode='22023';
 end if;
 select * into linked from public.payroll_ledger_links where settlement_id=p_settlement_id;
 if found then
  select * into strict ledger from public.financial_ledger where id=linked.ledger_id;
  if linked.state<>'ACTIVE' or ledger.source_type is distinct from 'PAYROLL' or ledger.source_reference is distinct from p_settlement_id::text
   or ledger.idempotency_key is distinct from 'payroll-ledger:'||p_settlement_id::text or ledger.amount is distinct from p_amount
   or ledger.beneficiary_employee_id is distinct from p_employee_id or ledger.month_period is distinct from to_char(p_month+interval '1 month','MM/YYYY')
   or ledger.cancelled_at is not null then raise exception 'payroll_link_reconciliation_mismatch' using errcode='22023'; end if;
  return linked.ledger_id;
 end if;
 if exists(select 1 from public.salary_payment_emails where employee_id=p_employee_id and salary_month=p_month)
 or exists(select 1 from public.financial_ledger l where l.cancelled_at is null and coalesce(l.idempotency_key,'') not like 'payroll-ledger:%' and l.source_type is distinct from 'PAYROLL_SUPPLEMENT' and l.type in ('CHI_PHI','CHI_TIEU')
  and (l.source_type in ('PAYROLL','SALARY') or coalesce(l.category,'') ~* '^Lương([[:space:]]|$)')
  and (l.beneficiary_employee_id=p_employee_id or l.beneficiary_employee_id is null)
  and (l.month_period in (to_char(p_month,'MM/YYYY'),to_char(p_month+interval '1 month','MM/YYYY')) or l.month_period is null or l.month_period !~ '^(0[1-9]|1[0-2])/[0-9]{4}$')) then
  raise exception 'payroll_link_legacy_reconciliation' using errcode='55000';
 end if;
 insert into payroll_link_private.write_permits values(txid_current(),p_settlement_id,null,'CREATE');
 insert into public.financial_ledger(type,category,amount,requested_by,month_period,is_paid,payment_status,beneficiary_employee_id,creator_employee_id,source_type,source_reference,idempotency_key,transaction_date,description,updated_at)
 values('CHI_PHI','Lương',p_amount,null,to_char(p_month+interval '1 month','MM/YYYY'),false,'UNPAID',p_employee_id,p_actor_id,'PAYROLL',p_settlement_id::text,'payroll-ledger:'||p_settlement_id::text,(p_month+interval '1 month 9 days')::date,'Đối soát bản quyết toán đã chốt',clock_timestamp()) returning id into result;
 insert into public.payroll_ledger_links(settlement_id,ledger_id,created_by_employee_id) values(p_settlement_id,result,p_actor_id);
 perform payroll_link_private.audit(result,'CREATED',p_actor_id,'Đối soát bản quyết toán đã chốt',jsonb_build_object('settlement_id',p_settlement_id,'amount',p_amount,'reconciliation',true));
 delete from payroll_link_private.write_permits where transaction_id=txid_current();
 return result;
end $$;

-- Linked ledger updates are guarded by private permits and the source snapshot.
-- The legacy guard interprets month_period as a payroll month for manual rows.
drop trigger salary_payroll_reopen_guard on public.financial_ledger;
create trigger salary_payroll_reopen_guard before insert or update on public.financial_ledger
 for each row when (coalesce(new.idempotency_key,'') not like 'payroll-ledger:%'
  and coalesce(new.idempotency_key,'') not like 'payroll-supplement:%')
 execute function public.guard_reopened_salary_payment();

revoke all on all functions in schema payroll_link_private from public,anon,authenticated,service_role;
revoke all on function public.create_payroll_supplement(uuid,numeric,text,uuid) from public,anon,authenticated,service_role;
grant execute on function public.create_payroll_supplement(uuid,numeric,text,uuid) to authenticated;
revoke all on function public.settle_monthly_payroll(bigint,date),public.create_payroll_adjustment(uuid,numeric,text),public.reopen_monthly_payroll(uuid,text),public.confirm_salary_ledger_payment(bigint,date,bigint) from public,anon,authenticated,service_role;
grant execute on function public.settle_monthly_payroll(bigint,date),public.create_payroll_adjustment(uuid,numeric,text),public.reopen_monthly_payroll(uuid,text) to authenticated;
grant execute on function public.confirm_salary_ledger_payment(bigint,date,bigint) to service_role;
commit;
