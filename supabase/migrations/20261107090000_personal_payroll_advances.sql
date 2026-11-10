begin;

create table public.finance_personal_advances (
  ledger_id bigint primary key references public.financial_ledger(id) on delete restrict,
  shareholder_id bigint not null references public.shareholders(id) on delete restrict,
  counter_id bigint unique not null references public.financial_ledger(id) on delete restrict,
  actor_id bigint not null references public.employees(id) on delete restrict,
  check (ledger_id <> counter_id)
);

create table public.finance_personal_advance_refunds (
  request_id uuid primary key,
  advance_id bigint not null references public.finance_personal_advances(ledger_id) on delete restrict,
  ledger_id bigint unique not null references public.financial_ledger(id) on delete restrict
);
create index finance_personal_advance_refunds_advance_idx
  on public.finance_personal_advance_refunds(advance_id);

alter table public.finance_personal_advances enable row level security;
alter table public.finance_personal_advance_refunds enable row level security;
revoke all on public.finance_personal_advances, public.finance_personal_advance_refunds from public, anon, authenticated, service_role;
grant select on public.finance_personal_advances, public.finance_personal_advance_refunds to service_role;

-- Called only from the authorized finance service. The parent ledger is locked
-- by both operations so a source correction cannot race a refund.
create function public.record_payroll_personal_advance(p_ledger_id bigint, p_shareholder_id bigint, p_actor_id bigint)
returns void language plpgsql security definer set search_path = '' as $$
declare
  original public.financial_ledger%rowtype;
  previous public.finance_personal_advances%rowtype;
  source_name text;
  counter bigint;
begin
  select * into original from public.financial_ledger where id = p_ledger_id for update;
  if not found or original.cancelled_at is not null or original.is_paid is distinct from true
     or original.amount is null or original.amount <= 0
     or original.source_type not in ('PAYROLL', 'PAYROLL_SUPPLEMENT')
     or not (exists (select 1 from public.payroll_ledger_links k where k.ledger_id = original.id and k.state = 'ACTIVE')
          or exists (select 1 from public.payroll_supplemental_obligations k where k.ledger_id = original.id))
  then raise exception 'advance_payroll_invalid' using errcode = '22023'; end if;

  select * into previous from public.finance_personal_advances where ledger_id = original.id;
  if previous.shareholder_id is not distinct from p_shareholder_id then return; end if;
  if exists (select 1 from public.finance_personal_advance_refunds where advance_id = original.id) then
    raise exception 'advance_already_refunded' using errcode = '22023';
  end if;
  if p_shareholder_id is not null then
    select name into source_name from public.shareholders where id = p_shareholder_id and status = 'ACTIVE';
    if nullif(btrim(source_name), '') is null then
      raise exception 'advance_shareholder_invalid' using errcode = '22023';
    end if;
  end if;
  perform set_config('app.activity_actor', p_actor_id::text, true);
  if previous.counter_id is not null then
    delete from public.finance_personal_advances where ledger_id = original.id;
    update public.financial_ledger set cancelled_at = clock_timestamp(), updated_at = clock_timestamp() where id = previous.counter_id;
  end if;
  if p_shareholder_id is not null then
    insert into public.financial_ledger(type, sub_type, category, amount, month_period, transaction_date,
      requested_by, is_paid, payment_status, creator_employee_id, source_type, source_reference)
    values ('VON_GOP', 'HIEN_VAT', 'Ứng tiền cá nhân', original.amount, original.month_period, original.transaction_date,
      source_name, true, 'PAID', p_actor_id, 'PERSONAL_ADVANCE', original.id::text || ':' || gen_random_uuid()::text) returning id into counter;
    insert into public.finance_personal_advances values (original.id, p_shareholder_id, counter, p_actor_id);
  end if;
  insert into public.erp_activity_events(actor_employee_id,entity,entity_id,action,screen,summary,changes_text)
  values (p_actor_id,'ledger',original.id,'UPDATE','Sổ thu chi','Đổi nguồn chi lương',
    concat('Nguồn trước ', coalesce((select name from public.shareholders where id = previous.shareholder_id), 'Quỹ chung'),
      ' → ', coalesce(source_name, 'Quỹ chung')));
end $$;

create function public.confirm_payroll_payment_with_source(p_ledger_id bigint, p_salary_month date, p_actor_id bigint, p_shareholder_id bigint)
returns uuid language plpgsql security definer set search_path = '' as $$
declare result uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended('payroll-reopen-salary-payment', 0));
  if exists (select 1 from public.financial_ledger where id = p_ledger_id and is_paid) then
    raise exception 'payment_already_recorded' using errcode = '22023';
  end if;
  result := public.confirm_salary_ledger_payment(p_ledger_id, p_salary_month, p_actor_id);
  perform public.record_payroll_personal_advance(p_ledger_id, p_shareholder_id, p_actor_id);
  return result;
end $$;

create function public.record_personal_advance_refund(p_advance_id bigint, p_amount numeric, p_actor_id bigint, p_request_id uuid)
returns bigint language plpgsql security definer set search_path = '' as $$
declare
  original public.financial_ledger%rowtype;
  previous public.finance_personal_advance_refunds%rowtype;
  source_name text;
  refunded numeric;
  entry bigint;
  local_day date := (clock_timestamp() at time zone 'Asia/Ho_Chi_Minh')::date;
begin
  if p_request_id is null or p_amount is null or p_amount <= 0 or p_amount > 999999999999
     or p_amount <> trunc(p_amount) then
    raise exception 'refund_amount_invalid' using errcode = '22023';
  end if;
  select * into original from public.financial_ledger where id = p_advance_id for update;
  if not found or original.cancelled_at is not null or original.is_paid is distinct from true then
    raise exception 'refund_advance_invalid' using errcode = '22023';
  end if;
  select * into previous from public.finance_personal_advance_refunds where request_id = p_request_id;
  if found then
    if previous.advance_id <> p_advance_id or not exists (
      select 1 from public.financial_ledger where id = previous.ledger_id and amount = p_amount
    ) then raise exception 'refund_request_conflict' using errcode = '22023'; end if;
    return previous.ledger_id;
  end if;
  select s.name into source_name from public.finance_personal_advances a
    join public.shareholders s on s.id = a.shareholder_id where a.ledger_id = original.id;
  if not found then raise exception 'refund_advance_invalid' using errcode = '22023'; end if;
  select coalesce(sum(l.amount), 0) into refunded from public.finance_personal_advance_refunds r
    join public.financial_ledger l on l.id = r.ledger_id where r.advance_id = original.id;
  if p_amount > original.amount - refunded then raise exception 'refund_exceeds_outstanding' using errcode = '22023'; end if;
  perform set_config('app.activity_actor', p_actor_id::text, true);
  insert into public.financial_ledger(type, category, amount, month_period, transaction_date, is_paid,
    payment_status, paid_at, creator_employee_id, payment_confirmer_employee_id, beneficiary_external_name, source_type, source_reference)
  values ('CHI_TIEU', 'Hoàn tiền ứng cá nhân', p_amount, to_char(local_day, 'MM/YYYY'), local_day, true, 'PAID',
    clock_timestamp(), p_actor_id, p_actor_id, source_name, 'PERSONAL_ADVANCE_REFUND', p_request_id::text) returning id into entry;
  insert into public.finance_personal_advance_refunds values (p_request_id, original.id, entry);
  return entry;
end $$;

revoke all on function public.record_payroll_personal_advance(bigint,bigint,bigint),
  public.confirm_payroll_payment_with_source(bigint,date,bigint,bigint),
  public.record_personal_advance_refund(bigint,numeric,bigint,uuid) from public, anon, authenticated, service_role;
grant execute on function public.record_payroll_personal_advance(bigint,bigint,bigint),
  public.confirm_payroll_payment_with_source(bigint,date,bigint,bigint),
  public.record_personal_advance_refund(bigint,numeric,bigint,uuid) to service_role;

create function public.list_personal_advances()
returns jsonb language sql stable security invoker set search_path = '' as $$
  select coalesce(jsonb_agg(to_jsonb(t) order by t.ledger_id desc), '[]'::jsonb)
  from (
    select l.id as ledger_id, a.shareholder_id, s.name as person, l.category, l.month_period, l.amount as advanced,
      coalesce((select sum(p.amount) from public.finance_personal_advance_refunds r
        join public.financial_ledger p on p.id = r.ledger_id where r.advance_id = a.ledger_id), 0) as refunded
    from public.finance_personal_advances a join public.financial_ledger l on l.id = a.ledger_id
    join public.shareholders s on s.id = a.shareholder_id
  ) t;
$$;
revoke all on function public.list_personal_advances() from public, anon, authenticated, service_role;
grant execute on function public.list_personal_advances() to service_role;

create function public.guard_personal_advance_rows()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if ((tg_op <> 'DELETE' and new.source_type in ('PERSONAL_ADVANCE', 'PERSONAL_ADVANCE_REFUND'))
      or (tg_op <> 'INSERT' and old.source_type in ('PERSONAL_ADVANCE', 'PERSONAL_ADVANCE_REFUND')))
      and current_user <> pg_get_userbyid((select proowner from pg_proc where oid =
        'public.record_personal_advance_refund(bigint,numeric,bigint,uuid)'::regprocedure))
  then raise exception 'advance_ledger_protected' using errcode = '42501'; end if;
  if tg_op = 'UPDATE' and old.source_type in ('PERSONAL_ADVANCE', 'PERSONAL_ADVANCE_REFUND') and (
     old.source_type <> 'PERSONAL_ADVANCE' or old.cancelled_at is not null or new.cancelled_at is null
     or (to_jsonb(old) - array['cancelled_at','updated_at']) is distinct from (to_jsonb(new) - array['cancelled_at','updated_at'])
  ) then raise exception 'advance_ledger_protected' using errcode = '42501'; end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
create trigger personal_advance_ledger_guard before insert or update or delete on public.financial_ledger
for each row execute function public.guard_personal_advance_rows();
revoke all on function public.guard_personal_advance_rows() from public, anon, authenticated, service_role;

commit;
