begin;
-- Turn SALARY_PAYMENT_EMAIL_ENABLED=false and redeploy first. Keep receipts and templates.
drop function if exists public.confirm_salary_ledger_payment(bigint,date,bigint);
revoke all on public.salary_payment_emails from service_role;
grant select on public.salary_payment_emails to service_role;
commit;
