begin transaction read only;
select c.relname, c.relrowsecurity, c.relacl,
  (select jsonb_agg(pg_get_triggerdef(t.oid)) from pg_trigger t where t.tgrelid=c.oid and not t.tgisinternal) as triggers
from pg_class c where c.oid in ('public.task_comments'::regclass,'public.project_activity'::regclass,'public.phase_status_history'::regclass);
select tablename, policyname, cmd, roles, qual, with_check from pg_policies
where schemaname='public' and tablename in ('task_comments','project_activity','phase_status_history');
select conrelid::regclass as relation, conname, pg_get_constraintdef(oid) as definition
from pg_constraint where conrelid in ('public.task_comments'::regclass,'public.project_activity'::regclass,'public.phase_status_history'::regclass);
select 'task_comments' as relation, count(*) from public.task_comments
union all select 'project_activity', count(*) from public.project_activity
union all select 'phase_status_history', count(*) from public.phase_status_history;
select 'task_comments' as relation, count(*) as orphan_count from public.task_comments h
left join public.projects p on p.id=h.project_id left join public.tasks t on t.id=h.task_id
where p.id is null or (h.task_id is not null and (t.id is null or t.project_id<>h.project_id))
union all select 'project_activity', count(*) from public.project_activity h
left join public.projects p on p.id=h.project_id left join public.tasks t on t.id=h.task_id
where p.id is null or (h.task_id is not null and (t.id is null or t.project_id<>h.project_id))
union all select 'phase_status_history', count(*) from public.phase_status_history h
left join public.projects p on p.id=h.project_id left join public.phases ph on ph.id=h.phase_id
where p.id is null or ph.id is null or ph.project_id<>h.project_id;
rollback;
