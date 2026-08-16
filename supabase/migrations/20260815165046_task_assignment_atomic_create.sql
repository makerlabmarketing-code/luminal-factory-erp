-- Task Assignment: atomic create with database-owned invariant checks.
-- Delivery only. Keep TASK_ASSIGNMENT_ATOMIC_CREATE_ENABLED false/unset until
-- the migration, grants, fixture matrix, and atomic rollback behavior pass.

begin;

do $$
begin
  if to_regclass('public.projects') is null
    or to_regclass('public.phases') is null
    or to_regclass('public.tasks') is null
    or to_regclass('public.employees') is null
    or to_regclass('public.project_members') is null
    or to_regclass('public.employee_workspace_access') is null
    or to_regclass('public.employee_permissions') is null
    or to_regclass('public.task_comments') is null
    or to_regclass('public.project_activity') is null
    or to_regclass('public.task_notifications') is null then
    raise exception 'Precondition failed: task assignment foundation is incomplete.';
  end if;
end $$;

-- Remove the superseded draft signature if it was ever installed manually. It
-- accepted date-only deadlines and must not remain as a parallel RPC surface.
do $$
begin
  if to_regprocedure('public.create_project_task_atomic(bigint,bigint,bigint,text,text,bigint,date,text,bigint)') is not null then
    execute 'revoke all on function public.create_project_task_atomic(bigint, bigint, bigint, text, text, bigint, date, text, bigint) from public, anon, authenticated, service_role';
  end if;
end $$;
drop function if exists public.create_project_task_atomic(bigint, bigint, bigint, text, text, bigint, date, text, bigint);

create or replace function public.create_project_task_atomic(
  p_project_id bigint,
  p_phase_id bigint,
  p_parent_task_id bigint,
  p_title text,
  p_description text,
  p_assignee_employee_id bigint,
  p_deadline timestamptz,
  p_comment text,
  p_actor_employee_id bigint
)
returns public.tasks
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_actor_role text;
  v_authorized boolean := false;
  v_title text := btrim(coalesce(p_title, ''));
  v_comment text := nullif(btrim(coalesce(p_comment, '')), '');
  v_project_status text;
  v_created_task public.tasks%rowtype;
begin
  if p_project_id is null or p_project_id <= 0
    or p_actor_employee_id is null or p_actor_employee_id <= 0
    or length(v_title) not between 1 and 160
    or length(coalesce(p_description, '')) > 2000
    or length(coalesce(v_comment, '')) > 2000 then
    raise exception 'task_assignment_invalid_input';
  end if;

  select upper(coalesce(p.status, ''))
  into v_project_status
  from public.projects p
  where p.id = p_project_id
  for update;
  if not found then
    raise exception 'task_assignment_project_not_found';
  end if;
  if v_project_status in ('CANCELLED', 'ARCHIVED') then
    raise exception 'task_assignment_project_closed';
  end if;

  select upper(coalesce(e.role, ''))
  into v_actor_role
  from public.employees e
  where e.id = p_actor_employee_id
    and coalesce(e.is_active, true) = true
    and upper(coalesce(e.status, 'ACTIVE')) = 'ACTIVE';
  if not found then
    raise exception 'task_assignment_permission_forbidden';
  end if;

  v_authorized := v_actor_role in ('ADMIN', 'OWNER')
    or exists (
      select 1
      from public.project_members pm
      where pm.project_id = p_project_id
        and pm.employee_id = p_actor_employee_id
        and pm.status = 'ACTIVE'
        and pm.role_code in ('PROJECT_OWNER', 'PROJECT_MANAGER')
    )
    or (
      exists (
        select 1
        from public.employee_workspace_access ewa
        where ewa.employee_id = p_actor_employee_id
          and ewa.workspace = 'ADMIN_WORKSPACE'
          and ewa.status = 'ACTIVE'
          and ewa.revoked_at is null
      )
      and exists (
        select 1
        from public.employee_permissions ep
        where ep.employee_id = p_actor_employee_id
          and ep.permission_code = 'PROJECT_MANAGE'
          and ep.effect = 'ALLOW'
          and ep.status = 'ACTIVE'
          and ep.revoked_at is null
      )
      and not exists (
        select 1
        from public.employee_permissions ep
        where ep.employee_id = p_actor_employee_id
          and ep.permission_code = 'PROJECT_MANAGE'
          and ep.effect = 'DENY'
          and ep.status = 'ACTIVE'
          and ep.revoked_at is null
      )
    );
  if not v_authorized then
    raise exception 'task_assignment_permission_forbidden';
  end if;

  if p_phase_id is not null and not exists (
    select 1 from public.phases ph
    where ph.id = p_phase_id and ph.project_id = p_project_id
  ) then
    raise exception 'task_assignment_phase_invalid';
  end if;

  if p_parent_task_id is not null and not exists (
    select 1 from public.tasks t
    where t.id = p_parent_task_id and t.project_id = p_project_id
  ) then
    raise exception 'task_assignment_parent_invalid';
  end if;

  if p_assignee_employee_id is not null and not exists (
    select 1
    from public.project_members pm
    join public.employees e on e.id = pm.employee_id
    where pm.project_id = p_project_id
      and pm.employee_id = p_assignee_employee_id
      and pm.status = 'ACTIVE'
      and coalesce(e.is_active, true) = true
      and upper(coalesce(e.status, 'ACTIVE')) = 'ACTIVE'
  ) then
    raise exception 'task_assignment_assignee_invalid';
  end if;

  insert into public.tasks (
    project_id, phase_id, parent_task_id, title, description,
    assignee_employee_id, deadline, status, created_by_employee_id,
    updated_by_employee_id, assigned_by_employee_id, assigned_at, updated_at
  ) values (
    p_project_id, p_phase_id, p_parent_task_id, v_title, p_description,
    p_assignee_employee_id, p_deadline, 'BACKLOG', p_actor_employee_id,
    p_actor_employee_id,
    case when p_assignee_employee_id is null then null else p_actor_employee_id end,
    case when p_assignee_employee_id is null then null else clock_timestamp() end,
    clock_timestamp()
  ) returning * into v_created_task;

  if v_comment is not null then
    insert into public.task_comments (project_id, task_id, employee_id, body)
    values (p_project_id, v_created_task.id, p_actor_employee_id, v_comment);
  end if;

  insert into public.project_activity (
    project_id, task_id, actor_employee_id, activity_type, payload
  ) values (
    p_project_id,
    v_created_task.id,
    p_actor_employee_id,
    'TASK_CREATED',
    jsonb_build_object(
      'title', v_title,
      'assigneeEmployeeId', p_assignee_employee_id
    )
  );

  if p_assignee_employee_id is not null then
    insert into public.task_notifications (
      project_id, task_id, recipient_employee_id, notification_type, payload
    ) values (
      p_project_id,
      v_created_task.id,
      p_assignee_employee_id,
      'TASK_ASSIGNED',
      jsonb_build_object('assignedByEmployeeId', p_actor_employee_id)
    );
  end if;

  return v_created_task;
end;
$$;

comment on function public.create_project_task_atomic(bigint, bigint, bigint, text, text, bigint, timestamptz, text, bigint) is
  'Creates one task plus its initial comment, activity, and assignment notification atomically after project-scoped authorization and relationship validation.';

revoke all on function public.create_project_task_atomic(bigint, bigint, bigint, text, text, bigint, timestamptz, text, bigint)
  from public, anon, authenticated;
grant execute on function public.create_project_task_atomic(bigint, bigint, bigint, text, text, bigint, timestamptz, text, bigint)
  to service_role;

commit;
