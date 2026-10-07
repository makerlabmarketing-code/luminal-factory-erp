-- Read-only. All checks must be true before approved application.
select to_regclass('public.erp_activity_events') is null as new_history_table_absent,
 to_regprocedure('public.update_erp_record_with_history(text,bigint,jsonb,bigint,text)') is null as new_rpc_absent,
 to_regclass('public.employees') is not null as employees_present,
 to_regclass('public.financial_ledger') is not null as ledger_present;
select proname, pg_get_function_identity_arguments(oid) as arguments
from pg_proc where pronamespace='public'::regnamespace and proname='update_linked_financial_ledger_entry';
select table_name,column_name,data_type from information_schema.columns
where table_schema='public' and table_name in ('employees','financial_ledger') order by table_name,ordinal_position;
select tgname from pg_trigger where tgrelid in ('public.employees'::regclass,'public.financial_ledger'::regclass) and not tgisinternal;
