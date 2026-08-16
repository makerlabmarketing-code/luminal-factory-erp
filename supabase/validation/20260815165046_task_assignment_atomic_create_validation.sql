-- READ ONLY. Run after migration delivery and before runtime activation.
begin transaction read only;

select p.oid::regprocedure as signature,
       p.prosecdef as security_definer,
       p.proconfig as function_config,
       has_function_privilege('public', p.oid, 'EXECUTE') as public_can_execute,
       has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can_execute,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_can_execute,
       has_function_privilege('service_role', p.oid, 'EXECUTE') as service_role_can_execute
from pg_proc p
where p.oid = to_regprocedure(
  'public.create_project_task_atomic(bigint,bigint,bigint,text,text,bigint,timestamptz,text,bigint)'
);

-- PASS: one row; invoker; search_path=public, pg_temp; only service_role executes.
select count(*) as invalid_assigned_tasks
from public.tasks t
where t.assignee_employee_id is not null
  and not exists (
    select 1
    from public.project_members pm
    join public.employees e on e.id = pm.employee_id
    where pm.project_id = t.project_id
      and pm.employee_id = t.assignee_employee_id
      and pm.status = 'ACTIVE'
      and coalesce(e.is_active, true) = true
      and upper(coalesce(e.status, 'ACTIVE')) = 'ACTIVE'
  );

select count(*) as cross_project_phase_tasks
from public.tasks t
join public.phases ph on ph.id = t.phase_id
where t.project_id is distinct from ph.project_id;

select count(*) as cross_project_parent_tasks
from public.tasks child
join public.tasks parent on parent.id = child.parent_task_id
where child.project_id is distinct from parent.project_id;

-- Fixture matrix (non-production only): authorized create with/without optional
-- comment and assignee; inactive/non-member assignee; cross-project phase/parent;
-- contributor actor; cancelled/archived project; forced side-effect failure.
-- For each rejected/forced-failure call, compare task/comment/activity/notification
-- counts before and after. PASS requires no partial rows.

rollback;
