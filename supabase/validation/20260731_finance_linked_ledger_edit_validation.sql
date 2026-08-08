-- Read-only post-run validation for the linked-ledger atomic update RPC.
select
  p.oid::regprocedure::text as function_signature,
  p.prosecdef as security_definer,
  p.proconfig as function_config,
  has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute,
  has_function_privilege('service_role', p.oid, 'EXECUTE') as service_role_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'update_linked_financial_ledger_entry';

select grantee, privilege_type
from information_schema.routine_privileges
where specific_schema = 'public'
  and routine_name = 'update_linked_financial_ledger_entry'
order by grantee, privilege_type;

select relrowsecurity as rls_enabled, relforcerowsecurity as rls_forced
from pg_class
where oid = 'public.financial_ledger'::regclass;

select rolname, rolbypassrls
from pg_roles
where rolname in ('authenticated', 'service_role')
order by rolname;

select count(*) as ambiguous_active_counter_groups
from (
  select category, requested_by
  from public.financial_ledger
  where type = 'VON_GOP'
    and category like '[Đối ứng] Vốn hiện vật:%'
  group by category, requested_by
  having count(*) > 1
) duplicate_groups;
