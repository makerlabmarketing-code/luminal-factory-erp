-- Read-only post-run validation.
select to_regclass('public.payroll_settlements') is not null as settlements_present, to_regclass('public.payroll_adjustments') is not null as adjustments_present, to_regclass('public.payroll_audit_history') is not null as audit_present;
select to_regprocedure('public.settle_monthly_payroll(bigint,date)') is not null as settle_rpc_present, to_regprocedure('public.create_payroll_adjustment(uuid,numeric,text)') is not null as adjustment_rpc_present;
select count(*)=4 as payroll_permissions_present from public.permissions where code in ('PAYROLL_VIEW','PAYROLL_SETTLE','PAYROLL_ADJUST','PAYROLL_CONFIGURE');
select count(*)=5 as payroll_select_policies_present from pg_policies where schemaname='public' and policyname like 'payroll % select';
select count(*)=0 as no_duplicate_settlement from (select employee_id,payroll_month from public.payroll_settlements group by 1,2 having count(*)>1) d;
select count(*)=0 as no_automatic_historical_settlement from public.payroll_settlements s cross join public.payroll_configuration c where s.payroll_month<c.first_settlement_month;
select count(*)=0 as server_audit_fields_complete from public.payroll_audit_history where actor_employee_id is null or occurred_at is null;
