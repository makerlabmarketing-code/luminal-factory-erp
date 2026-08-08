-- Finance linked-ledger atomic update boundary.
-- The application calls this only through the server-side service_role client
-- after ADMIN_WORKSPACE + FINANCE_UPDATE authorization has already succeeded.

create or replace function public.update_linked_financial_ledger_entry(
  p_entry_id bigint,
  p_type text,
  p_sub_type text,
  p_category text,
  p_amount numeric,
  p_requested_by text,
  p_month_period text,
  p_is_paid boolean,
  p_should_have_link boolean,
  p_update_extended boolean,
  p_transaction_date date,
  p_description text,
  p_project_id bigint,
  p_beneficiary_employee_id bigint,
  p_beneficiary_external_name text,
  p_payer_employee_id bigint,
  p_payment_status text
) returns text
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_original public.financial_ledger%rowtype;
  v_link_ids bigint[] := '{}'::bigint[];
  v_link_count integer := 0;
  v_link_id bigint;
  v_action text := 'NONE';
  v_link_category text;
  v_target_link_category text;
  v_old_lock_key text;
  v_target_lock_key text;
  v_target_conflicts integer := 0;
begin
  if p_entry_id is null or p_entry_id <= 0 then
    raise exception using errcode = '22023', message = 'invalid ledger entry id';
  end if;

  if p_type is null or btrim(p_type) = ''
     or p_category is null or btrim(p_category) = ''
     or p_amount is null or p_amount <= 0
     or p_month_period is null or p_month_period !~ '^(0[1-9]|1[0-2])/\d{4}$' then
    raise exception using errcode = '22023', message = 'invalid ledger update payload';
  end if;

  select * into strict v_original
  from public.financial_ledger
  where id = p_entry_id
  for update;

  if v_original.type = 'VON_GOP'
     and coalesce(v_original.category, '') ~ '^\[(Đối ứng|Hủy đối ứng)\]' then
    raise exception using errcode = '22023', message = 'managed counter row cannot be edited directly';
  end if;

  v_link_category := '[Đối ứng] Vốn hiện vật: ' || v_original.category;
  v_target_link_category := '[Đối ứng] Vốn hiện vật: ' || p_category;
  v_old_lock_key := coalesce(v_original.category, '') || chr(31) || coalesce(v_original.requested_by, '');
  v_target_lock_key := coalesce(p_category, '') || chr(31) || coalesce(p_requested_by, '');

  -- Serialize operations touching the old and target link identities.
  perform pg_advisory_xact_lock(hashtextextended(v_old_lock_key, 0));
  if v_target_lock_key <> v_old_lock_key then
    perform pg_advisory_xact_lock(hashtextextended(v_target_lock_key, 0));
  end if;

  select coalesce(array_agg(candidate.id order by candidate.id), '{}'::bigint[])
  into v_link_ids
  from (
    select id
    from public.financial_ledger
    where type = 'VON_GOP'
      and category = v_link_category
      and requested_by is not distinct from v_original.requested_by
    order by id
    limit 2
  ) candidate;

  v_link_count := coalesce(array_length(v_link_ids, 1), 0);
  if v_link_count > 1 then
    raise exception using errcode = '21000', message = 'ambiguous linked ledger entries';
  end if;

  if v_link_count = 1 then
    v_link_id := v_link_ids[1];
    perform 1 from public.financial_ledger where id = v_link_id for update;
  end if;

  if v_link_count = 0 and p_should_have_link then
    v_action := 'CREATE';
  elsif v_link_count = 1 and p_should_have_link then
    v_action := 'UPDATE';
  elsif v_link_count = 1 and not p_should_have_link then
    v_action := 'CANCEL';
  end if;

  if v_action in ('CREATE', 'UPDATE') then
    select count(*)
    into v_target_conflicts
    from public.financial_ledger
    where type = 'VON_GOP'
      and category = v_target_link_category
      and requested_by is not distinct from p_requested_by
      and (v_link_id is null or id <> v_link_id);

    if v_target_conflicts > 0 then
      raise exception using errcode = '23505', message = 'target linked ledger entry already exists';
    end if;
  end if;

  update public.financial_ledger
  set type = p_type,
      sub_type = p_sub_type,
      category = p_category,
      amount = p_amount,
      requested_by = p_requested_by,
      month_period = p_month_period,
      is_paid = p_is_paid,
      transaction_date = case when p_update_extended then p_transaction_date else transaction_date end,
      description = case when p_update_extended then p_description else description end,
      project_id = case when p_update_extended then p_project_id else project_id end,
      beneficiary_employee_id = case when p_update_extended then p_beneficiary_employee_id else beneficiary_employee_id end,
      beneficiary_external_name = case when p_update_extended then p_beneficiary_external_name else beneficiary_external_name end,
      payer_employee_id = case when p_update_extended then p_payer_employee_id else payer_employee_id end,
      payment_status = case when p_update_extended then p_payment_status else payment_status end,
      updated_at = case when p_update_extended then now() else updated_at end
  where id = p_entry_id;

  if v_action = 'CREATE' then
    insert into public.financial_ledger(
      type, sub_type, category, amount, requested_by, month_period, is_paid
    ) values (
      'VON_GOP', 'HIEN_VAT', v_target_link_category,
      p_amount, p_requested_by, p_month_period, true
    );
  elsif v_action = 'UPDATE' then
    update public.financial_ledger
    set category = v_target_link_category,
        amount = p_amount,
        requested_by = p_requested_by,
        month_period = p_month_period
    where id = v_link_id;
  elsif v_action = 'CANCEL' then
    update public.financial_ledger
    set category = '[Hủy đối ứng] ' || category
    where id = v_link_id;
  end if;

  return v_action;
exception
  when no_data_found then
    raise exception using errcode = 'P0002', message = 'ledger entry not found';
end;
$$;

revoke all on function public.update_linked_financial_ledger_entry(
  bigint, text, text, text, numeric, text, text, boolean, boolean, boolean,
  date, text, bigint, bigint, text, bigint, text
) from public, anon, authenticated;

grant execute on function public.update_linked_financial_ledger_entry(
  bigint, text, text, text, numeric, text, text, boolean, boolean, boolean,
  date, text, bigint, bigint, text, bigint, text
) to service_role;
