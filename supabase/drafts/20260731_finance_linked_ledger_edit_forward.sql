-- READY_FOR_OPERATOR. Do not execute from Codex Cloud.
create or replace function public.update_linked_financial_ledger_entry(
  p_entry_id bigint,
  p_type text,
  p_sub_type text,
  p_category text,
  p_amount numeric,
  p_requested_by text,
  p_month_period text,
  p_is_paid boolean,
  p_link_mode text
) returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_original public.financial_ledger%rowtype;
  v_link public.financial_ledger%rowtype;
begin
  if p_link_mode not in ('NONE', 'CREATE', 'UPDATE', 'CANCEL') then
    raise exception using errcode = '22023', message = 'invalid link mode';
  end if;

  select * into strict v_original
  from public.financial_ledger
  where id = p_entry_id
  for update;

  select * into v_link
  from public.financial_ledger
  where type = 'VON_GOP'
    and category = '[Đối ứng] Vốn hiện vật: ' || v_original.category
    and requested_by = v_original.requested_by
  order by id
  limit 1
  for update;

  if p_link_mode = 'CREATE' and v_link.id is not null then
    raise exception using errcode = '23505', message = 'linked entry already exists';
  elsif p_link_mode in ('UPDATE', 'CANCEL') and v_link.id is null then
    raise exception using errcode = 'P0002', message = 'linked entry not found';
  end if;

  update public.financial_ledger
  set type = p_type,
      sub_type = p_sub_type,
      category = p_category,
      amount = p_amount,
      requested_by = p_requested_by,
      month_period = p_month_period,
      is_paid = p_is_paid
  where id = p_entry_id;

  if p_link_mode = 'CREATE' then
    insert into public.financial_ledger(type, sub_type, category, amount, requested_by, month_period, is_paid)
    values ('VON_GOP', 'HIEN_VAT', '[Đối ứng] Vốn hiện vật: ' || p_category, p_amount, p_requested_by, p_month_period, true);
  elsif p_link_mode = 'UPDATE' then
    update public.financial_ledger
    set category = '[Đối ứng] Vốn hiện vật: ' || p_category,
        amount = p_amount,
        requested_by = p_requested_by,
        month_period = p_month_period
    where id = v_link.id;
  elsif p_link_mode = 'CANCEL' then
    update public.financial_ledger
    set category = '[Hủy đối ứng] ' || v_link.category
    where id = v_link.id;
  end if;
end;
$$;

revoke all on function public.update_linked_financial_ledger_entry(bigint, text, text, text, numeric, text, text, boolean, text) from public, anon;
grant execute on function public.update_linked_financial_ledger_entry(bigint, text, text, text, numeric, text, text, boolean, text) to authenticated;
