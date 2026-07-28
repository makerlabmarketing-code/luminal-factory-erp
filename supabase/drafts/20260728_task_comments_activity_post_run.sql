begin transaction read only;
select tgrelid::regclass as object_name, tgname from pg_trigger where not tgisinternal and tgname in ('task_comments_immutable','project_activity_immutable') order by 1;
select has_table_privilege('authenticated', 'public.task_comments', 'INSERT') as authenticated_can_insert_comment, has_table_privilege('authenticated', 'public.project_activity', 'UPDATE') as authenticated_can_update_activity;
select count(*) as project_comment_count from public.task_comments where task_id is null;
rollback;
