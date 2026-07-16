-- DRAFT ONLY - DO NOT RUN WITHOUT APPROVAL.
-- Phase Workflow Foundation validation queries.
-- Intended to be run after approved migration rollout, not during this audit.

-- Column shape.
select
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'phases'
  and column_name in (
    'description',
    'status',
    'assignee_employee_id',
    'deadline',
    'started_at',
    'completed_at',
    'updated_at',
    'updated_by_employee_id'
  )
order by column_name;

-- Constraints/indexes/policies.
select conname, contype
from pg_constraint
where conrelid = 'public.phases'::regclass
  and conname in (
    'phases_status_check',
    'phases_assignee_employee_id_fkey',
    'phases_updated_by_employee_id_fkey',
    'phases_completed_at_status_check',
    'phases_started_completed_order_check'
  )
order by conname;

select indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and tablename = 'phases'
  and indexname in (
    'phases_project_order_unique',
    'phases_project_status_order_idx',
    'phases_assignee_employee_id_idx',
    'phases_deadline_idx',
    'phases_updated_at_idx'
  )
order by indexname;

select policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename = 'phases'
order by policyname;

-- Data integrity.
select project_id, order_index, count(*) as duplicate_count
from public.phases
group by project_id, order_index
having count(*) > 1
order by project_id, order_index;

select p.id, p.project_id
from public.phases p
left join public.projects project on project.id = p.project_id
where project.id is null
order by p.id
limit 50;

select p.id, p.assignee_employee_id
from public.phases p
left join public.employees employee on employee.id = p.assignee_employee_id
where p.assignee_employee_id is not null
  and employee.id is null
order by p.id
limit 50;

select p.id, p.assignee_employee_id
from public.phases p
join public.employees employee on employee.id = p.assignee_employee_id
where p.assignee_employee_id is not null
  and (employee.is_active = false or upper(coalesce(employee.status, '')) in ('INACTIVE', 'LOCKED'))
order by p.id
limit 50;

select p.id, p.project_id, p.assignee_employee_id
from public.phases p
where p.assignee_employee_id is not null
  and not exists (
    select 1
    from public.project_members pm
    where pm.project_id = p.project_id
      and pm.employee_id = p.assignee_employee_id
      and pm.status = 'ACTIVE'
  )
order by p.id
limit 50;

select status, count(*)
from public.phases
group by status
order by status;
