-- READ ONLY. Run after the atomic task-create RPC rollout and before enabling the runtime flag.
begin transaction read only;

select p.oid::regprocedure as signature,
       p.prosecdef as security_definer,
       has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can_execute,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_can_execute,
       has_function_privilege('service_role', p.oid, 'EXECUTE') as service_role_can_execute
from pg_proc p
where p.oid = to_regprocedure(
  'public.create_project_task_atomic(bigint,bigint,bigint,text,text,bigint,date,text,bigint)'
);

-- PASS: one row, security_definer=false, anon/authenticated=false, service_role=true.
rollback;
