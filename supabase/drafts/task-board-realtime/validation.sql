select polname, polcmd, pg_get_expr(polqual, polrelid) as filter
from pg_policy where polrelid = to_regclass('realtime.messages');
select tgname, tgenabled from pg_trigger
where tgrelid = 'public.project_activity'::regclass and tgname = 'erp_task_board_status_changed';
select has_function_privilege('authenticated', 'public.broadcast_erp_task_status()', 'EXECUTE') as authenticated_execute,
       has_function_privilege('anon', 'public.broadcast_erp_task_status()', 'EXECUTE') as anon_execute;
