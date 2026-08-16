-- OPERATOR-GATED ROLLBACK. Disable TASK_ASSIGNMENT_ATOMIC_CREATE_ENABLED first.
-- Existing tasks and side-effect rows created successfully by the RPC are retained.
begin;
revoke all on function public.create_project_task_atomic(bigint, bigint, bigint, text, text, bigint, timestamptz, text, bigint)
  from public, anon, authenticated, service_role;
drop function if exists public.create_project_task_atomic(bigint, bigint, bigint, text, text, bigint, timestamptz, text, bigint);
commit;
