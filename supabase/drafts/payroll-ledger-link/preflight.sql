-- READ ONLY. Record and review these results before proposing a migration.
select current_setting('server_version') version;
select to_regnamespace('payroll_link_private') existing_private_schema,
 to_regclass('public.payroll_ledger_links') existing_link_table;
select p.oid::regprocedure signature,p.prosecdef,p.proconfig,p.proacl,
 md5(pg_get_functiondef(p.oid)) definition_md5,pg_get_functiondef(p.oid) definition
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in ('settle_monthly_payroll','create_payroll_adjustment','reopen_monthly_payroll','confirm_salary_ledger_payment','payroll_result');
select conrelid::regclass relation,conname,pg_get_constraintdef(oid) definition from pg_constraint
where conrelid in ('public.financial_ledger'::regclass,'public.payroll_active_settlements'::regclass,'public.salary_payment_emails'::regclass);
select tgrelid::regclass relation,tgname,pg_get_triggerdef(oid) definition from pg_trigger
where not tgisinternal and tgrelid in ('public.financial_ledger'::regclass,'public.payroll_settlements'::regclass,'public.payroll_adjustments'::regclass,'public.salary_payment_emails'::regclass);
select table_name,column_name,data_type,is_nullable,column_default from information_schema.columns
where table_schema='public' and table_name in ('financial_ledger','finance_ledger_history','payroll_settlements','salary_payment_emails') order by table_name,ordinal_position;
select count(*) reserved_marker_collisions from public.financial_ledger
where idempotency_key like 'payroll-ledger:%';
select pg_describe_object(d.classid,d.objid,d.objsubid) consumer,d.refobjid::regprocedure referenced_rpc,d.deptype
from pg_depend d where d.refclassid='pg_proc'::regclass and d.refobjid in (
 'public.settle_monthly_payroll(bigint,date)'::regprocedure,'public.create_payroll_adjustment(uuid,numeric,text)'::regprocedure,
 'public.reopen_monthly_payroll(uuid,text)'::regprocedure,'public.confirm_salary_ledger_payment(bigint,date,bigint)'::regprocedure);
-- IDs only: every pre-existing active snapshot needs explicit reconciliation.
select employee_id,payroll_month,settlement_id from public.payroll_active_settlements order by employee_id,payroll_month;
-- No backfill or configuration update is included in this file.
