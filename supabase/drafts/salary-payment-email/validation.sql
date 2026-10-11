select relrowsecurity from pg_class where oid='public.salary_payment_emails'::regclass;
select role,has_table_privilege(role,'public.salary_payment_emails','SELECT') as can_select,
 has_table_privilege(role,'public.salary_payment_emails','INSERT') as can_insert,
 has_function_privilege(role,'public.confirm_salary_ledger_payment(bigint,date,bigint)','EXECUTE') as can_execute
 from (values ('anon'),('authenticated'),('service_role')) roles(role);
select prosecdef,proconfig from pg_proc where oid='public.confirm_salary_ledger_payment(bigint,date,bigint)'::regprocedure;
select group_type,is_active,count(*) from public.email_templates where group_type='SALARY_PAYMENT_CONFIRMED' group by group_type,is_active;
select status,count(*) from public.salary_payment_emails group by status;
