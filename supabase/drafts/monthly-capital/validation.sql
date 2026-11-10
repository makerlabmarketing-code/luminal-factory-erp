select jobname, schedule, active from cron.job where jobname = 'erp-monthly-capital-contributions';
select public.list_monthly_capital_rates();
select has_function_privilege('service_role', 'public.set_monthly_capital_rate(bigint,bigint,bigint,timestamptz)', 'execute') as server_can_save,
       not has_function_privilege('authenticated', 'public.set_monthly_capital_rate(bigint,bigint,bigint,timestamptz)', 'execute') as browser_denied;
select payer_employee_id, month_period, count(*) from public.financial_ledger
where source_type = 'MONTHLY_CAPITAL' group by payer_employee_id, month_period having count(*) > 1;
