-- READ ONLY, after an explicitly approved rollout. ON is not enabled by forward.sql.
select mode from payroll_link_private.configuration;
select n.nspname,p.proname,p.prosecdef,p.proconfig,p.proacl from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='payroll_link_private' or (n.nspname='public' and p.proname in ('settle_monthly_payroll','create_payroll_adjustment','reopen_monthly_payroll','confirm_salary_ledger_payment'));
select c.relname,c.relrowsecurity,c.relacl from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='payroll_link_private' or (n.nspname='public' and c.relname='payroll_ledger_links');
select count(*) leaked_permits from payroll_link_private.write_permits;
select count(*) broken_supplements from public.payroll_supplemental_obligations x
join public.payroll_settlements s on s.id=x.settlement_id join public.financial_ledger l on l.id=x.ledger_id
where l.source_type is distinct from 'PAYROLL_SUPPLEMENT' or l.source_reference is distinct from x.id::text
or l.idempotency_key is distinct from 'payroll-supplement:'||x.id::text or l.amount is distinct from x.amount
or l.beneficiary_employee_id is distinct from s.employee_id or l.month_period is distinct from to_char(s.payroll_month,'MM/YYYY')
or l.cancelled_at is not null or x.amount<=0;
select count(*) broken_links from public.payroll_ledger_links k
join public.financial_ledger l on l.id=k.ledger_id join public.payroll_settlements s on s.id=k.settlement_id
where l.source_type is distinct from 'PAYROLL' or l.source_reference is distinct from s.id::text
or l.idempotency_key is distinct from 'payroll-ledger:'||s.id::text
or l.beneficiary_employee_id is distinct from s.employee_id or l.month_period is distinct from to_char(s.payroll_month,'MM/YYYY')
or (k.state='ACTIVE' and (l.cancelled_at is not null or not exists(select 1 from public.payroll_active_settlements a where a.settlement_id=s.id)))
or (k.state='SUPERSEDED' and l.cancelled_at is null);
select count(*) bad_zero_payments from public.payroll_ledger_links k join public.financial_ledger l on l.id=k.ledger_id
where l.amount=0 and (coalesce(l.is_paid,false) or l.paid_at is not null or exists(select 1 from public.salary_payment_emails e where e.ledger_id=l.id));
