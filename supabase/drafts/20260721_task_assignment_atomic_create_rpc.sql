-- DRAFT ONLY - DO NOT RUN WITHOUT LIVE APPROVAL.
-- Review-debt remediation draft for atomic task creation.
-- Goal: task insert, initial comment, activity log, and assignment notification commit or roll back together.

create or replace function public.create_project_task_atomic(
  p_project_id bigint,
  p_phase_id bigint,
  p_parent_task_id bigint,
  p_title text,
  p_description text,
  p_assignee_employee_id bigint,
  p_deadline date,
  p_comment text,
  p_actor_employee_id bigint
)
returns public.tasks
language plpgsql
security invoker
as $$
declare
  created_task public.tasks;
begin
  insert into public.tasks (
    project_id,
    phase_id,
    parent_task_id,
    title,
    description,
    assignee_employee_id,
    deadline,
    status,
    created_by_employee_id,
    updated_by_employee_id,
    assigned_by_employee_id,
    assigned_at,
    updated_at
  )
  values (
    p_project_id,
    p_phase_id,
    p_parent_task_id,
    p_title,
    p_description,
    p_assignee_employee_id,
    p_deadline,
    'BACKLOG',
    p_actor_employee_id,
    p_actor_employee_id,
    case when p_assignee_employee_id is null then null else p_actor_employee_id end,
    case when p_assignee_employee_id is null then null else now() end,
    now()
  )
  returning * into created_task;

  if nullif(trim(coalesce(p_comment, '')), '') is not null then
    insert into public.task_comments (project_id, task_id, employee_id, body)
    values (p_project_id, created_task.id, p_actor_employee_id, trim(p_comment));
  end if;

  insert into public.project_activity (project_id, task_id, actor_employee_id, activity_type, payload)
  values (
    p_project_id,
    created_task.id,
    p_actor_employee_id,
    'TASK_CREATED',
    jsonb_build_object('title', p_title, 'assigneeEmployeeId', p_assignee_employee_id)
  );

  if p_assignee_employee_id is not null then
    insert into public.task_notifications (project_id, task_id, recipient_employee_id, notification_type, payload)
    values (
      p_project_id,
      created_task.id,
      p_assignee_employee_id,
      'TASK_ASSIGNED',
      jsonb_build_object('assignedByEmployeeId', p_actor_employee_id)
    );
  end if;

  return created_task;
end;
$$;

comment on function public.create_project_task_atomic(bigint, bigint, bigint, text, text, bigint, date, text, bigint) is
  'Atomic task creation boundary. Requires separate RLS/execute grant review before live use.';
