begin transaction read only;
select to_regclass('public.task_comments') as task_comments, to_regclass('public.project_activity') as project_activity;
select count(*) as orphan_task_comments from public.task_comments c left join public.projects p on p.id = c.project_id left join public.tasks t on t.id = c.task_id where p.id is null or (c.task_id is not null and (t.id is null or t.project_id <> c.project_id));
select count(*) as orphan_activity from public.project_activity a left join public.projects p on p.id = a.project_id left join public.tasks t on t.id = a.task_id where p.id is null or (a.task_id is not null and (t.id is null or t.project_id <> a.project_id));
rollback;
