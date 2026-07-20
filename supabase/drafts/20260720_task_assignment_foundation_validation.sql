-- DRAFT ONLY - READ-ONLY VALIDATION AFTER APPROVED MIGRATION.

-- Required task columns.
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'tasks'
  and column_name in (
    'project_id',
    'phase_id',
    'parent_task_id',
    'title',
    'description',
    'assignee_employee_id',
    'deadline',
    'status',
    'created_by_employee_id',
    'updated_by_employee_id',
    'assigned_by_employee_id',
    'assigned_at',
    'completed_at',
    'updated_at'
  )
order by column_name;

-- Required supporting tables.
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('task_comments', 'project_activity', 'task_notifications')
order by table_name;

-- FK orphan checks.
select count(*) as tasks_with_missing_project
from public.tasks task
left join public.projects project on project.id = task.project_id
where task.project_id is not null
  and project.id is null;

select count(*) as tasks_with_missing_phase
from public.tasks task
left join public.phases phase on phase.id = task.phase_id
where task.phase_id is not null
  and phase.id is null;

select count(*) as tasks_with_missing_assignee
from public.tasks task
left join public.employees employee on employee.id = task.assignee_employee_id
where task.assignee_employee_id is not null
  and employee.id is null;

-- Assignment must resolve to ACTIVE project membership after backfill.
select count(*) as assigned_tasks_without_active_membership
from public.tasks task
where task.project_id is not null
  and task.assignee_employee_id is not null
  and not exists (
    select 1
    from public.project_members member
    where member.project_id = task.project_id
      and member.employee_id = task.assignee_employee_id
      and member.status = 'ACTIVE'
  );

-- RLS policy presence for read paths.
select tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
  and tablename in ('task_comments', 'project_activity', 'task_notifications')
order by tablename, policyname;


-- Required prerequisite helpers.
select
  'required_helper_functions' as check_name,
  proname,
  pg_get_function_identity_arguments(pg_proc.oid) as arguments
from pg_proc
join pg_namespace on pg_namespace.oid = pg_proc.pronamespace
where pg_namespace.nspname = 'public'
  and (
    (proname = 'current_employee_id' and pg_get_function_identity_arguments(pg_proc.oid) = '')
    or (proname = 'can_view_project' and pg_get_function_identity_arguments(pg_proc.oid) = 'target_project_id bigint')
  )
order by proname;

-- Required constraints.
select conname, contype
from pg_constraint
where conrelid = 'public.tasks'::regclass
  and conname in ('tasks_assignment_status_check', 'tasks_assignment_title_not_blank')
order by conname;

-- Invalid task status values after migration/backfill.
select status, count(*)
from public.tasks
where status is not null
  and status not in (
    'BACKLOG',
    'READY',
    'IN_PROGRESS',
    'PENDING_REVIEW',
    'REVISION_REQUIRED',
    'APPROVED',
    'BLOCKED',
    'ON_HOLD',
    'COMPLETED',
    'CANCELLED'
  )
group by status
order by status;

-- Task hierarchy checks.
select count(*) as tasks_with_self_parent
from public.tasks
where parent_task_id is not null
  and parent_task_id = id;

select count(*) as tasks_with_missing_parent
from public.tasks child
left join public.tasks parent on parent.id = child.parent_task_id
where child.parent_task_id is not null
  and parent.id is null;

select count(*) as tasks_with_parent_project_mismatch
from public.tasks child
join public.tasks parent on parent.id = child.parent_task_id
where child.parent_task_id is not null
  and child.project_id is not null
  and parent.project_id is not null
  and child.project_id <> parent.project_id;

with recursive task_tree as (
  select id, parent_task_id, array[id] as path, false as cycle_found
  from public.tasks
  where parent_task_id is not null

  union all

  select parent.id, parent.parent_task_id, task_tree.path || parent.id, parent.id = any(task_tree.path) as cycle_found
  from task_tree
  join public.tasks parent on parent.id = task_tree.parent_task_id
  where not task_tree.cycle_found
)
select count(*) as task_hierarchy_cycles
from task_tree
where cycle_found;

-- Supporting table project/task consistency.
select count(*) as task_comments_project_mismatch
from public.task_comments comment
join public.tasks task on task.id = comment.task_id
where task.project_id is not null
  and comment.project_id <> task.project_id;

select count(*) as project_activity_project_mismatch
from public.project_activity activity
join public.tasks task on task.id = activity.task_id
where activity.task_id is not null
  and task.project_id is not null
  and activity.project_id <> task.project_id;

select count(*) as task_notifications_project_mismatch
from public.task_notifications notification
join public.tasks task on task.id = notification.task_id
where task.project_id is not null
  and notification.project_id <> task.project_id;

-- Incomplete normalized backfill indicators. These should be zero before enabling writes.
select count(*) as tasks_missing_project_id_after_backfill
from public.tasks
where project_id is null;

select count(*) as tasks_missing_title_after_backfill
from public.tasks
where title is null or length(btrim(title)) = 0;

-- Required indexes.
with expected_indexes(index_name) as (
  values
    ('tasks_project_id_idx'),
    ('tasks_project_phase_idx'),
    ('tasks_parent_task_id_idx'),
    ('tasks_assignee_employee_id_idx'),
    ('tasks_deadline_idx'),
    ('task_comments_task_created_idx'),
    ('task_comments_project_created_idx'),
    ('project_activity_project_created_idx'),
    ('project_activity_task_created_idx'),
    ('task_notifications_recipient_status_idx')
)
select expected_indexes.index_name as missing_index
from expected_indexes
left join pg_indexes
  on pg_indexes.schemaname = 'public'
 and pg_indexes.indexname = expected_indexes.index_name
where pg_indexes.indexname is null
order by expected_indexes.index_name;

-- RLS enabled on supporting tables.
select relname, relrowsecurity
from pg_class
join pg_namespace on pg_namespace.oid = pg_class.relnamespace
where pg_namespace.nspname = 'public'
  and relname in ('task_comments', 'project_activity', 'task_notifications')
order by relname;

-- Expected read policies.
with expected_policies(tablename, policyname, cmd) as (
  values
    ('task_comments', 'task comments project access select', 'SELECT'),
    ('project_activity', 'project activity project access select', 'SELECT'),
    ('task_notifications', 'task notifications recipient select', 'SELECT')
)
select expected_policies.tablename, expected_policies.policyname, expected_policies.cmd
from expected_policies
left join pg_policies
  on pg_policies.schemaname = 'public'
 and pg_policies.tablename = expected_policies.tablename
 and pg_policies.policyname = expected_policies.policyname
 and pg_policies.cmd = expected_policies.cmd
where pg_policies.policyname is null
order by expected_policies.tablename, expected_policies.policyname;

-- Browser-side write policies must not exist for supporting tables in this draft.
select tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
  and tablename in ('task_comments', 'project_activity', 'task_notifications')
  and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
order by tablename, policyname;
