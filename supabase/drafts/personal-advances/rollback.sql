-- Disable FINANCE_PERSONAL_ADVANCES_ENABLED before rolling back application code.
-- Keep the schema if any real payment-source classification or refund has been recorded.
begin;
do $$
begin
  if exists (select 1 from public.financial_ledger where source_type in ('PERSONAL_ADVANCE','PERSONAL_ADVANCE_REFUND')) then
    raise exception 'advance_history_exists_keep_schema';
  end if;
end $$;
drop trigger personal_advance_ledger_guard on public.financial_ledger;
drop function public.guard_personal_advance_rows();
drop function public.list_personal_advances();
drop function public.record_personal_advance_refund(bigint,numeric,bigint,uuid);
drop function public.confirm_payroll_payment_with_source(bigint,date,bigint,bigint);
drop function public.record_payroll_personal_advance(bigint,bigint,bigint);
drop table public.finance_personal_advance_refunds, public.finance_personal_advances;
commit;
