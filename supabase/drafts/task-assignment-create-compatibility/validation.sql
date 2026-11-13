select p.prosecdef, p.proconfig,
       has_function_privilege('service_role', p.oid, 'EXECUTE') as service_role_execute,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute,
       has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
       position('v_project_name' in p.prosrc) > 0 as legacy_columns_supported
from pg_proc p
where p.oid = to_regprocedure('public.create_project_task_atomic(bigint,bigint,bigint,text,text,bigint,timestamptz,text,bigint)');
