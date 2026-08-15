-- READ ONLY. Run before the atomic task-create migration is delivered.
begin transaction read only;

select to_regclass('public.projects') as projects,
       to_regclass('public.phases') as phases,
       to_regclass('public.tasks') as tasks,
       to_regclass('public.employees') as employees,
       to_regclass('public.project_members') as project_members,
       to_regclass('public.employee_workspace_access') as employee_workspace_access,
       to_regclass('public.employee_permissions') as employee_permissions,
       to_regclass('public.task_comments') as task_comments,
       to_regclass('public.project_activity') as project_activity,
       to_regclass('public.task_notifications') as task_notifications;

select to_regprocedure(
  'public.create_project_task_atomic(bigint,bigint,bigint,text,text,bigint,timestamptz,text,bigint)'
) as expected_rpc,
to_regprocedure(
  'public.create_project_task_atomic(bigint,bigint,bigint,text,text,bigint,date,text,bigint)'
) as superseded_date_rpc;

select count(*) as tasks_before from public.tasks;
select count(*) as comments_before from public.task_comments;
select count(*) as activity_before from public.project_activity;
select count(*) as notifications_before from public.task_notifications;

rollback;
