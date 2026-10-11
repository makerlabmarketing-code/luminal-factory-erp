select to_regclass('public.salary_payment_emails') as existing_queue,
 to_regprocedure('public.confirm_salary_ledger_payment(bigint,date,bigint)') as existing_rpc;
select column_name,data_type from information_schema.columns where table_schema='public' and table_name in ('financial_ledger','employees','email_templates','email_history') order by table_name,ordinal_position;
select id,group_type,template_name,is_active from public.email_templates where group_type='SALARY_PAYMENT_CONFIRMED';
