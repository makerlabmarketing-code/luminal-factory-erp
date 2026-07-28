-- OPERATOR-GATED ROLLBACK. Does not delete tasks created while the RPC was active.
begin;
revoke all on function public.create_project_task_atomic(bigint, bigint, bigint, text, text, bigint, date, text, bigint) from public, anon, authenticated;
drop function if exists public.create_project_task_atomic(bigint, bigint, bigint, text, text, bigint, date, text, bigint);
commit;
