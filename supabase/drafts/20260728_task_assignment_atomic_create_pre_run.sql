-- READ ONLY. Run before the atomic task-create RPC rollout.
begin transaction read only;

select to_regclass('public.tasks') as tasks,
       to_regclass('public.task_comments') as task_comments,
       to_regclass('public.project_activity') as project_activity,
       to_regclass('public.task_notifications') as task_notifications;

select to_regprocedure(
  'public.create_project_task_atomic(bigint,bigint,bigint,text,text,bigint,date,text,bigint)'
) as existing_rpc;

select count(*) as tasks_before from public.tasks;
select count(*) as comments_before from public.task_comments;
select count(*) as activity_before from public.project_activity;
select count(*) as notifications_before from public.task_notifications;

rollback;
