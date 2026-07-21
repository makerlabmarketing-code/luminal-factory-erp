-- Corrective Slice 3A validation SQL. Read-only except test transaction blocks callers may wrap and roll back.
select jsonb_build_object(
  'rpc', (select jsonb_agg(jsonb_build_object(
    'args', pg_get_function_identity_arguments(p.oid),
    'security_definer', p.prosecdef,
    'anon_exec', has_function_privilege('anon','public.create_project_atomic(jsonb)','execute'),
    'authenticated_exec', has_function_privilege('authenticated','public.create_project_atomic(jsonb)','execute')
  )) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='create_project_atomic'),
  'project_code_column', exists(select 1 from information_schema.columns where table_schema='public' and table_name='projects' and column_name='project_code' and is_nullable='NO'),
  'project_code_unique_index', exists(select 1 from pg_indexes where schemaname='public' and tablename='projects' and indexname='projects_project_code_unique_idx'),
  'anon_browser_mutation_policies', (select count(*) from pg_policies where schemaname='public' and tablename in ('projects','phases','tasks','project_members','task_comments','task_notifications','project_activity') and cmd in ('INSERT','UPDATE','DELETE') and roles::text like '%anon%'),
  'orphan_phases', (select count(*) from public.phases ph where ph.project_id is not null and not exists (select 1 from public.projects p where p.id=ph.project_id)),
  'orphan_tasks', (select count(*) from public.tasks t where t.project_id is not null and not exists (select 1 from public.projects p where p.id=t.project_id)),
  'orphan_members', (select count(*) from public.project_members pm where not exists (select 1 from public.projects p where p.id=pm.project_id) or not exists (select 1 from public.employees e where e.id=pm.employee_id)),
  'orphan_comments', (select count(*) from public.task_comments c where not exists (select 1 from public.projects p where p.id=c.project_id) or not exists (select 1 from public.tasks t where t.id=c.task_id)),
  'orphan_notifications', (select count(*) from public.task_notifications n where not exists (select 1 from public.projects p where p.id=n.project_id) or not exists (select 1 from public.tasks t where t.id=n.task_id) or not exists (select 1 from public.employees e where e.id=n.recipient_employee_id)),
  'cross_project_task_parent', (select count(*) from public.tasks child join public.tasks parent on parent.id=child.parent_task_id where child.project_id is distinct from parent.project_id),
  'duplicate_project_codes', (select count(*) from (select upper(btrim(project_code)) code from public.projects group by 1 having count(*) > 1) d)
) as corrective_slice_3a_validation;
