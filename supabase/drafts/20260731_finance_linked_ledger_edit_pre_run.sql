-- Read-only pre-run. Do not execute without operator approval.
select to_regclass('public.financial_ledger') as financial_ledger_table;

select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'financial_ledger'
  and column_name in ('id', 'type', 'sub_type', 'category', 'amount', 'requested_by', 'month_period', 'is_paid')
order by ordinal_position;

select relrowsecurity as rls_enabled
from pg_class
where oid = 'public.financial_ledger'::regclass;

select policyname, cmd, roles
from pg_policies
where schemaname = 'public' and tablename = 'financial_ledger'
order by policyname;
