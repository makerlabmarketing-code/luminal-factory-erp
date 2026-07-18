-- DRAFT ONLY - READ-ONLY VALIDATION.
-- Intended execution after approved Phase Workflow Foundation rollout.
-- Do not run during review unless explicitly approved.

with expected as (
  select
    31::bigint as attendance_count,
    5::bigint as employees_count,
    64::bigint as financial_ledger_count,
    4::bigint as phases_count,
    6::bigint as project_members_count,
    6::bigint as projects_count,
    2::bigint as tasks_count,
    2::bigint as employee_workspace_access_count,
    17::bigint as employee_permissions_count
),
columns_check as (
  select column_name, data_type, is_nullable, column_default
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'phases'
),
checks as (
  select
    '01 expected phase columns exist' as check_name,
    case when count(*) filter (
      where column_name in (
        'description',
        'status',
        'deadline',
        'assignee_employee_id',
        'started_at',
        'completed_at',
        'updated_at',
        'updated_by_employee_id'
      )
    ) = 8 then 'PASS' else 'FAIL' end as status,
    jsonb_agg(column_name order by column_name)::text as detail
  from columns_check
  where column_name in (
    'description',
    'status',
    'deadline',
    'assignee_employee_id',
    'started_at',
    'completed_at',
    'updated_at',
    'updated_by_employee_id'
  )

  union all
  select
    '02 expected phase column types',
    case when
      exists (select 1 from columns_check where column_name = 'description' and data_type = 'text' and is_nullable = 'YES')
      and exists (select 1 from columns_check where column_name = 'status' and data_type = 'text' and is_nullable = 'NO')
      and exists (select 1 from columns_check where column_name = 'deadline' and data_type = 'date' and is_nullable = 'YES')
      and exists (select 1 from columns_check where column_name = 'assignee_employee_id' and data_type = 'bigint' and is_nullable = 'YES')
      and exists (select 1 from columns_check where column_name = 'started_at' and data_type = 'timestamp with time zone' and is_nullable = 'YES')
      and exists (select 1 from columns_check where column_name = 'completed_at' and data_type = 'timestamp with time zone' and is_nullable = 'YES')
      and exists (select 1 from columns_check where column_name = 'updated_at' and data_type = 'timestamp with time zone' and is_nullable = 'NO')
      and exists (select 1 from columns_check where column_name = 'updated_by_employee_id' and data_type = 'bigint' and is_nullable = 'YES')
    then 'PASS' else 'FAIL' end,
    (select jsonb_agg(to_jsonb(c) order by column_name)::text from columns_check c where column_name in (
      'description',
      'status',
      'deadline',
      'assignee_employee_id',
      'started_at',
      'completed_at',
      'updated_at',
      'updated_by_employee_id'
    ))

  union all
  select
    '03 deferred phase fields absent',
    case when not exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'phases'
        and column_name in (
          'previous_phase_id',
          'comment',
          'progress',
          'reviewer_id',
          'reviewer_employee_id',
          'task_assignment_id',
          'colorway_name',
          'stage_owner'
        )
    ) then 'PASS' else 'FAIL' end,
    null

  union all
  select
    '04 status constraint exact vocabulary',
    case when exists (
      select 1
      from pg_constraint
      where conrelid = 'public.phases'::regclass
        and conname = 'phases_status_check'
        and pg_get_constraintdef(oid) ilike all (array[
          '%NOT_STARTED%',
          '%IN_PROGRESS%',
          '%REVIEW%',
          '%BLOCKED%',
          '%COMPLETED%',
          '%CANCELLED%'
        ])
        and pg_get_constraintdef(oid) not ilike '%TODO%'
        and pg_get_constraintdef(oid) not ilike '%DOING%'
        and pg_get_constraintdef(oid) not ilike '%PROCESSING%'
        and pg_get_constraintdef(oid) not ilike '%SKIPPED%'
        and pg_get_constraintdef(oid) not ilike '%READY%'
    ) then 'PASS' else 'FAIL' end,
    null

  union all
  select
    '05 phase constraints exist',
    case when count(*) = 5 then 'PASS' else 'FAIL' end,
    jsonb_agg(conname order by conname)::text
  from pg_constraint
  where conrelid = 'public.phases'::regclass
    and conname in (
      'phases_status_check',
      'phases_assignee_employee_id_fkey',
      'phases_updated_by_employee_id_fkey',
      'phases_completed_at_status_check',
      'phases_started_completed_order_check'
    )

  union all
  select
    '06 phase indexes exist',
    case when count(*) = 5 then 'PASS' else 'FAIL' end,
    jsonb_agg(indexname order by indexname)::text
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

  union all
  select
    '07 phase trigger exists',
    case when exists (
      select 1
      from pg_trigger
      where tgrelid = 'public.phases'::regclass
        and tgname = 'phases_set_workflow_audit_fields'
        and not tgisinternal
    ) then 'PASS' else 'FAIL' end,
    null

  union all
  select
    '08 phase audit function exists',
    case when to_regprocedure('public.set_phase_workflow_audit_fields()') is not null
      then 'PASS' else 'FAIL' end,
    null

  union all
  select
    '09 phases rls and select policy',
    case when
      exists (
        select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public'
          and c.relname = 'phases'
          and c.relrowsecurity = true
      )
      and exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'phases'
          and policyname = 'phases project access select'
          and cmd = 'SELECT'
          and roles = '{authenticated}'
          and qual = 'can_view_project(project_id)'
          and with_check is null
      )
    then 'PASS' else 'FAIL' end,
    null

  union all
  select
    '10 no broad phase policies',
    case when not exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = 'phases'
        and (
          cmd = 'ALL'
          or 'anon' = any(roles)
          or (cmd = 'SELECT' and qual in ('true', '(true)'))
        )
    ) then 'PASS' else 'FAIL' end,
    null

  union all
  select
    '11 no duplicate project order',
    case when not exists (
      select 1
      from public.phases
      group by project_id, order_index
      having count(*) > 1
    ) then 'PASS' else 'FAIL' end,
    null

  union all
  select
    '12 no orphan project id',
    case when not exists (
      select 1
      from public.phases phase
      left join public.projects project on project.id = phase.project_id
      where project.id is null
    ) then 'PASS' else 'FAIL' end,
    null

  union all
  select
    '13 assignee integrity',
    case when not exists (
      select 1
      from public.phases phase
      left join public.employees employee on employee.id = phase.assignee_employee_id
      where phase.assignee_employee_id is not null
        and employee.id is null
    )
    and not exists (
      select 1
      from public.phases phase
      join public.employees employee on employee.id = phase.assignee_employee_id
      where phase.assignee_employee_id is not null
        and (
          employee.status <> 'ACTIVE'
          or coalesce(employee.is_active, true) = false
        )
    )
    and not exists (
      select 1
      from public.phases phase
      where phase.assignee_employee_id is not null
        and not exists (
          select 1
          from public.project_members member
          where member.project_id = phase.project_id
            and member.employee_id = phase.assignee_employee_id
            and member.status = 'ACTIVE'
        )
    ) then 'PASS' else 'FAIL' end,
    null

  union all
  select
    '14 statuses after foundation backfill',
    case when not exists (
      select 1
      from public.phases
      where status <> 'NOT_STARTED'
         or started_at is not null
         or completed_at is not null
         or assignee_employee_id is not null
         or deadline is not null
         or description is not null
    ) then 'PASS' else 'FAIL' end,
    (select jsonb_object_agg(status, row_count)::text from (
      select status, count(*) as row_count
      from public.phases
      group by status
    ) status_counts)

  union all
  select
    '15 attendance row count unchanged',
    case when (select count(*) from public.attendance) = (select attendance_count from expected) then 'PASS' else 'FAIL' end,
    (select count(*)::text from public.attendance)

  union all
  select
    '16 employees row count unchanged',
    case when (select count(*) from public.employees) = (select employees_count from expected) then 'PASS' else 'FAIL' end,
    (select count(*)::text from public.employees)

  union all
  select
    '17 financial_ledger row count unchanged',
    case when (select count(*) from public.financial_ledger) = (select financial_ledger_count from expected) then 'PASS' else 'FAIL' end,
    (select count(*)::text from public.financial_ledger)

  union all
  select
    '18 phases row count unchanged',
    case when (select count(*) from public.phases) = (select phases_count from expected) then 'PASS' else 'FAIL' end,
    (select count(*)::text from public.phases)

  union all
  select
    '19 project_members row count unchanged',
    case when (select count(*) from public.project_members) = (select project_members_count from expected) then 'PASS' else 'FAIL' end,
    (select count(*)::text from public.project_members)

  union all
  select
    '20 projects row count unchanged',
    case when (select count(*) from public.projects) = (select projects_count from expected) then 'PASS' else 'FAIL' end,
    (select count(*)::text from public.projects)

  union all
  select
    '21 tasks row count unchanged',
    case when (select count(*) from public.tasks) = (select tasks_count from expected) then 'PASS' else 'FAIL' end,
    (select count(*)::text from public.tasks)

  union all
  select
    '22 employee_workspace_access row count unchanged',
    case when (select count(*) from public.employee_workspace_access) = (select employee_workspace_access_count from expected) then 'PASS' else 'FAIL' end,
    (select count(*)::text from public.employee_workspace_access)

  union all
  select
    '23 employee_permissions row count unchanged',
    case when (select count(*) from public.employee_permissions) = (select employee_permissions_count from expected) then 'PASS' else 'FAIL' end,
    (select count(*)::text from public.employee_permissions)
)
select *
from checks
order by check_name;
