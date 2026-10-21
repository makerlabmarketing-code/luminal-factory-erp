select count(*) invalid_active from public.payroll_active_settlements a join public.payroll_settlements s on s.id=a.settlement_id where a.employee_id<>s.employee_id or a.payroll_month<>s.payroll_month;
select count(*) from public.payroll_adjustments;
select count(*) from public.payroll_settlement_reopenings;
select r,has_function_privilege(r,'public.set_test_ledger_archived(bigint,boolean,bigint,text)','EXECUTE') from unnest(array['anon','authenticated','service_role']) r;
