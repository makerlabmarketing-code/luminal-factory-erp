-- Read-only post-run validation.
select p.oid::regprocedure::text as function_signature,
       p.prosecdef as security_definer
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'update_linked_financial_ledger_entry';

select grantee, privilege_type
from information_schema.routine_privileges
where specific_schema = 'public'
  and routine_name = 'update_linked_financial_ledger_entry'
order by grantee, privilege_type;

select relrowsecurity as rls_enabled
from pg_class
where oid = 'public.financial_ledger'::regclass;
