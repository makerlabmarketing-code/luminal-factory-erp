-- Read-only pre-run validation for create_project_atomic(jsonb).
-- PASS requires every required relation/function to exist and no duplicate project code.
select object_name, object_exists
from (values
  ('projects', to_regclass('public.projects') is not null),
  ('employees', to_regclass('public.employees') is not null),
  ('project_members', to_regclass('public.project_members') is not null),
  ('phases', to_regclass('public.phases') is not null),
  ('tasks', to_regclass('public.tasks') is not null),
  ('task_comments', to_regclass('public.task_comments') is not null),
  ('project_activity', to_regclass('public.project_activity') is not null),
  ('task_notifications', to_regclass('public.task_notifications') is not null),
  ('has_workspace_access(text)', to_regprocedure('public.has_workspace_access(text)') is not null),
  ('has_permission(text)', to_regprocedure('public.has_permission(text)') is not null)
) checks(object_name, object_exists)
order by object_name;

select upper(btrim(project_code)) as normalized_code, count(*) as duplicate_count
from public.projects
where project_code is not null
group by upper(btrim(project_code))
having count(*) > 1;

select
  has_function_privilege('anon', 'public.create_project_atomic(jsonb)', 'EXECUTE') as anon_execute,
  has_function_privilege('authenticated', 'public.create_project_atomic(jsonb)', 'EXECUTE') as authenticated_execute
where to_regprocedure('public.create_project_atomic(jsonb)') is not null;
