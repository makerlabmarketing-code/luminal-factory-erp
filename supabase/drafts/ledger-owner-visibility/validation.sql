select polname,polpermissive,pg_get_expr(polqual,polrelid) from pg_policy where polrelid='public.financial_ledger'::regclass;
select has_function_privilege('anon','erp_ledger_access.is_owner()','EXECUTE') anon_execute,
 has_function_privilege('authenticated','erp_ledger_access.is_owner()','EXECUTE') authenticated_execute;
select relrowsecurity from pg_class where oid='public.financial_ledger'::regclass;
