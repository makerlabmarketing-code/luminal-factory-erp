-- Postflight, all statements read-only.
select relname,relrowsecurity from pg_class where oid in ('public.payroll_active_settlements'::regclass,'public.payroll_settlement_reopenings'::regclass);
select r,has_function_privilege(r,'public.reopen_monthly_payroll(uuid,text)','EXECUTE') can_reopen from unnest(array['anon','authenticated','service_role'])r;
select grantee,table_name,privilege_type from information_schema.role_table_grants where table_name in ('payroll_active_settlements','payroll_settlement_reopenings') order by table_name,grantee;
select count(*) invalid_active from public.payroll_active_settlements a left join public.payroll_settlements s on s.id=a.settlement_id where s.id is null or a.employee_id<>s.employee_id or a.payroll_month<>s.payroll_month or exists(select 1 from public.payroll_settlement_reopenings r where r.settlement_id=a.settlement_id);
select count(*) unaccounted_snapshots from public.payroll_settlements s where not exists(select 1 from public.payroll_active_settlements a where a.settlement_id=s.id) and not exists(select 1 from public.payroll_settlement_reopenings r where r.settlement_id=s.id);
select count(*) snapshot_count from public.payroll_settlements;
select count(*) reopening_count from public.payroll_settlement_reopenings;
