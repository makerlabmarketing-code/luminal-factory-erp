-- Read-only post-run validation for create_project_atomic(jsonb).
-- PASS: function exists, is not SECURITY DEFINER, and browser roles cannot execute it.
select
  procedure.oid::regprocedure::text as signature,
  not procedure.prosecdef as security_invoker,
  not has_function_privilege('anon', procedure.oid, 'EXECUTE') as anon_execute_revoked,
  not has_function_privilege('authenticated', procedure.oid, 'EXECUTE') as authenticated_execute_revoked,
  has_function_privilege('service_role', procedure.oid, 'EXECUTE') as service_role_execute
from pg_proc procedure
join pg_namespace namespace on namespace.oid = procedure.pronamespace
where namespace.nspname = 'public'
  and procedure.oid = to_regprocedure('public.create_project_atomic(jsonb)');

select
  column_name,
  is_nullable,
  data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'projects'
  and column_name = 'project_code';
