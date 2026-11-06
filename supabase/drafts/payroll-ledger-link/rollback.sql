-- Empty-package rollback only. Populated packages require a forward fix.
begin;
do $$begin
 if exists(select 1 from public.payroll_ledger_links) or exists(select 1 from public.payroll_supplemental_obligations) or exists(select 1 from payroll_link_private.write_permits) then
  raise exception 'payroll_link_history_requires_forward_fix';
 end if;
end $$;
drop trigger payroll_link_ledger_guard on public.financial_ledger;
drop trigger salary_payroll_reopen_guard on public.financial_ledger;
create trigger salary_payroll_reopen_guard before insert or update on public.financial_ledger
 for each row execute function public.guard_reopened_salary_payment();
drop function public.create_payroll_supplement(uuid,numeric,text,uuid);
drop table public.payroll_supplemental_obligations;
drop function public.settle_monthly_payroll(bigint,date),public.create_payroll_adjustment(uuid,numeric,text),public.reopen_monthly_payroll(uuid,text),public.confirm_salary_ledger_payment(bigint,date,bigint);
alter function payroll_link_private.settle_monthly_payroll(bigint,date) set schema public;
alter function payroll_link_private.create_payroll_adjustment(uuid,numeric,text) set schema public;
alter function payroll_link_private.reopen_monthly_payroll(uuid,text) set schema public;
alter function payroll_link_private.confirm_salary_ledger_payment(bigint,date,bigint) set schema public;
grant execute on function public.settle_monthly_payroll(bigint,date),public.create_payroll_adjustment(uuid,numeric,text),public.reopen_monthly_payroll(uuid,text) to authenticated;
grant execute on function public.confirm_salary_ledger_payment(bigint,date,bigint) to service_role;
drop table public.payroll_ledger_links;
drop schema payroll_link_private cascade;
commit;
