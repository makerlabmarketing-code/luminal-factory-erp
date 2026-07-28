-- Destructive rollback. Run only after exporting payroll records and disabling PAYROLL_SETTLEMENT_ENABLED.
begin;
drop function if exists public.get_my_monthly_payroll(date),public.list_monthly_payroll_for_admin(date),public.configure_payroll_first_month(date),public.settle_monthly_payroll(bigint,date),public.create_payroll_adjustment(uuid,numeric,text),public.payroll_result(date,bigint),public.payroll_month_calculation(bigint,date),public.block_immutable_payroll_change() cascade;
drop table if exists public.payroll_audit_history,public.payroll_adjustments,public.payroll_settlements,public.payroll_configuration;
drop type if exists public.payroll_result_row;
delete from public.permissions where code in ('PAYROLL_VIEW','PAYROLL_SETTLE','PAYROLL_ADJUST','PAYROLL_CONFIGURE') and not exists(select 1 from public.employee_permissions ep where ep.permission_code=permissions.code);
commit;
