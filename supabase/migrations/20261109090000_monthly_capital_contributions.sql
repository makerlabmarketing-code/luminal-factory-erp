begin;

create extension if not exists pg_cron;

create table public.finance_monthly_capital_rates (
  employee_id bigint not null references public.employees(id) on delete restrict,
  effective_month date not null check (extract(day from effective_month) = 1),
  amount bigint not null check (amount between 1 and 999999999999),
  updated_at timestamptz not null default clock_timestamp(),
  updated_by bigint references public.employees(id) on delete restrict,
  primary key (employee_id, effective_month)
);

alter table public.finance_monthly_capital_rates enable row level security;
revoke all on public.finance_monthly_capital_rates from public, anon, authenticated, service_role;

create function public.list_monthly_capital_rates()
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(to_jsonb(latest) order by latest.employee_id), '[]'::jsonb)
  from (
    select distinct on (r.employee_id) r.employee_id, e.full_name, r.amount, r.effective_month, r.updated_at
    from public.finance_monthly_capital_rates r
    join public.employees e on e.id = r.employee_id
    order by r.employee_id, r.effective_month desc
  ) latest;
$$;

create function public.set_monthly_capital_rate(p_employee_id bigint, p_amount bigint, p_actor_id bigint, p_expected_at timestamptz)
returns date language plpgsql security definer set search_path = '' as $$
declare
  local_day date := (clock_timestamp() at time zone 'Asia/Ho_Chi_Minh')::date;
  target_month date := date_trunc('month', local_day::timestamp)::date;
  previous_at timestamptz;
begin
  perform pg_advisory_xact_lock(hashtextextended('finance-monthly-capital', 0));
  select updated_at into previous_at
    from public.finance_monthly_capital_rates where employee_id = p_employee_id
    order by effective_month desc limit 1;
  if not found or p_amount is null or p_amount not between 1 and 999999999999
      or p_actor_id is null or p_expected_at is null then
    raise exception 'monthly_capital_invalid_rate' using errcode = '22023';
  end if;
  if previous_at is distinct from p_expected_at then
    raise exception 'monthly_capital_rate_changed' using errcode = '40001';
  end if;
  if extract(day from local_day) >= 10 then
    target_month := (target_month + interval '1 month')::date;
  end if;

  insert into public.finance_monthly_capital_rates(employee_id, effective_month, amount, updated_by)
  values (p_employee_id, target_month, p_amount, p_actor_id)
  on conflict (employee_id, effective_month) do update
  set amount = excluded.amount, updated_by = excluded.updated_by, updated_at = clock_timestamp();
  return target_month;
end $$;

create function public.generate_monthly_capital_contributions()
returns integer language plpgsql security definer set search_path = '' as $$
declare
  local_day date := (clock_timestamp() at time zone 'Asia/Ho_Chi_Minh')::date;
  current_month date := date_trunc('month', local_day::timestamp)::date;
  inserted integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('finance-monthly-capital', 0));
  with due as (
    select distinct on (r.employee_id, periods.month_start)
      r.employee_id, r.amount, periods.month_start::date as month_start
    from public.finance_monthly_capital_rates r
    cross join lateral generate_series(r.effective_month::timestamp, current_month::timestamp, interval '1 month') periods(month_start)
    where periods.month_start::date + 9 <= local_day
    order by r.employee_id, periods.month_start, r.effective_month desc
  )
  insert into public.financial_ledger(type, sub_type, category, amount, requested_by, payer_employee_id,
    month_period, transaction_date, is_paid, payment_status, source_type, source_reference)
  select 'VON_GOP', 'TIEN_MAT', 'Góp vốn', d.amount, e.full_name, e.id,
    to_char(d.month_start, 'MM/YYYY'), d.month_start + 9, false, 'UNPAID', 'MONTHLY_CAPITAL',
    e.id::text || ':' || to_char(d.month_start, 'YYYY-MM')
  from due d join public.employees e on e.id = d.employee_id
  where e.status = 'ACTIVE' and e.is_active
    and not exists (
      select 1 from public.financial_ledger l
      where l.type = 'VON_GOP' and l.sub_type is distinct from 'HIEN_VAT'
        and l.month_period = to_char(d.month_start, 'MM/YYYY')
        and (l.payer_employee_id = e.id or l.requested_by = e.full_name)
    )
  on conflict (source_type, source_reference) do nothing;
  get diagnostics inserted = row_count;
  return inserted;
end $$;

revoke all on function public.list_monthly_capital_rates(),
  public.set_monthly_capital_rate(bigint,bigint,bigint,timestamptz),
  public.generate_monthly_capital_contributions() from public, anon, authenticated, service_role;
grant execute on function public.list_monthly_capital_rates(),
  public.set_monthly_capital_rate(bigint,bigint,bigint,timestamptz) to service_role;

-- 00:05 UTC is 07:05 in Vietnam. Running daily also catches a missed due day.
select cron.schedule('erp-monthly-capital-contributions', '5 0 * * *',
  'select public.generate_monthly_capital_contributions()');

commit;
