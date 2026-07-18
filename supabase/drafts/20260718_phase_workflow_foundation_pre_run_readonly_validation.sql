-- READ-ONLY VALIDATION ONLY
-- SAFE TO RUN AGAINST LINKED PRODUCTION DATABASE
-- NO DDL OR DML

select
  '01_live_phases_columns' as section,
  c.ordinal_position::text as item_order,
  c.column_name,
  c.data_type,
  c.udt_name,
  c.is_nullable,
  c.column_default,
  c.is_identity,
  c.identity_generation,
  c.is_generated,
  c.generation_expression
from information_schema.columns c
where c.table_schema = 'public'
  and c.table_name = 'phases'
order by c.ordinal_position;

select
  '02_live_phases_constraints' as section,
  con.conname as object_name,
  con.contype,
  con.convalidated,
  pg_get_constraintdef(con.oid, true) as definition
from pg_constraint con
where con.conrelid = 'public.phases'::regclass
order by con.contype, con.conname;

select
  '03_live_phases_indexes' as section,
  i.indexname as object_name,
  i.indexdef as definition
from pg_indexes i
where i.schemaname = 'public'
  and i.tablename = 'phases'
order by i.indexname;

select
  '04_live_phases_triggers' as section,
  t.tgname as object_name,
  t.tgenabled,
  pg_get_triggerdef(t.oid, true) as definition
from pg_trigger t
where t.tgrelid = 'public.phases'::regclass
  and not t.tgisinternal
order by t.tgname;

select
  '05_live_phases_rls' as section,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as force_rls
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname = 'phases';

select
  '06_live_phases_policies' as section,
  p.policyname,
  p.cmd,
  p.roles,
  p.qual,
  p.with_check
from pg_policies p
where p.schemaname = 'public'
  and p.tablename = 'phases'
order by p.policyname;

select
  '07_live_phases_grants' as section,
  g.grantee,
  g.privilege_type,
  g.is_grantable
from information_schema.role_table_grants g
where g.table_schema = 'public'
  and g.table_name = 'phases'
  and g.grantee in ('anon', 'authenticated', 'public')
order by g.grantee, g.privilege_type;

select
  '08_live_function_conflicts' as section,
  p.proname,
  pg_get_function_identity_arguments(p.oid) as identity_args,
  pg_get_function_result(p.oid) as result_type,
  pg_get_userbyid(p.proowner) as owner_name,
  lang.lanname as language_name,
  p.prosecdef as security_definer,
  p.provolatile as volatility,
  p.proconfig,
  pg_get_functiondef(p.oid) as definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
join pg_language lang on lang.oid = p.prolang
where n.nspname = 'public'
  and p.proname in (
    'set_phase_workflow_audit_fields',
    'set_phase_workflow_updated_at',
    'prevent_invalid_phase_previous_phase',
    'can_view_project',
    'current_employee_id'
  )
order by p.proname, pg_get_function_identity_arguments(p.oid);

with row_counts as (
  select 'phases' as table_name, count(*)::bigint as row_count from public.phases
  union all
  select 'projects', count(*)::bigint from public.projects
  union all
  select 'project_members', count(*)::bigint from public.project_members
  union all
  select 'tasks', count(*)::bigint from public.tasks
  union all
  select 'employees', count(*)::bigint from public.employees
  union all
  select 'employee_workspace_access', count(*)::bigint from public.employee_workspace_access
  union all
  select 'employee_permissions', count(*)::bigint from public.employee_permissions
  union all
  select 'attendance', count(*)::bigint from public.attendance
  union all
  select 'financial_ledger', count(*)::bigint from public.financial_ledger
)
select
  '09_row_count_snapshot' as section,
  table_name,
  row_count
from row_counts
order by table_name;

select
  '10_phase_count_by_project' as section,
  p.project_id,
  count(*)::bigint as phase_count,
  min(p.order_index) as min_order_index,
  max(p.order_index) as max_order_index
from public.phases p
group by p.project_id
order by p.project_id;

with checks as (
  select 'phase_rows' as check_name, count(*)::bigint as issue_count
  from public.phases
  union all
  select 'null_project_id', count(*)::bigint
  from public.phases
  where project_id is null
  union all
  select 'orphan_project_id', count(*)::bigint
  from public.phases phase
  left join public.projects project on project.id = phase.project_id
  where phase.project_id is not null
    and project.id is null
  union all
  select 'duplicate_project_order_index_groups', count(*)::bigint
  from (
    select project_id, order_index
    from public.phases
    group by project_id, order_index
    having count(*) > 1
  ) duplicate_order
  union all
  select 'duplicate_project_phase_name_groups', count(*)::bigint
  from (
    select project_id, name
    from public.phases
    where name is not null
    group by project_id, name
    having count(*) > 1
  ) duplicate_names
  union all
  select 'negative_order_index', count(*)::bigint
  from public.phases
  where order_index < 0
  union all
  select 'large_order_index_over_1000', count(*)::bigint
  from public.phases
  where order_index > 1000
  union all
  select 'project_cancelled_with_phase_rows', count(*)::bigint
  from public.phases phase
  join public.projects project on project.id = phase.project_id
  where coalesce(project.status, '') = 'CANCELLED'
)
select
  '11_data_quality_summary' as section,
  check_name,
  issue_count
from checks
order by check_name;

select
  '12_duplicate_order_index_detail' as section,
  project_id,
  order_index,
  count(*)::bigint as duplicate_count,
  array_agg(id order by id) as phase_ids
from public.phases
group by project_id, order_index
having count(*) > 1
order by project_id, order_index;

select
  '13_duplicate_phase_name_detail' as section,
  project_id,
  md5(coalesce(name, '')) as phase_name_hash,
  count(*)::bigint as duplicate_count,
  array_agg(id order by id) as phase_ids
from public.phases
where name is not null
group by project_id, md5(coalesce(name, ''))
having count(*) > 1
order by project_id, phase_name_hash;

select
  '14_orphan_project_detail' as section,
  phase.id as phase_id,
  phase.project_id,
  phase.order_index
from public.phases phase
left join public.projects project on project.id = phase.project_id
where phase.project_id is null
   or project.id is null
order by phase.id
limit 50;

select
  '15_sample_phase_rows_non_sensitive' as section,
  phase.id as phase_id,
  phase.project_id,
  phase.order_index,
  phase.created_at
from public.phases phase
order by phase.project_id nulls first, phase.order_index, phase.id
limit 50;

with expected_columns as (
  select *
  from (
    values
      ('status', 'text', 'text', 'NO', '''NOT_STARTED''::text'),
      ('description', 'text', 'text', 'YES', null),
      ('deadline', 'date', 'date', 'YES', null),
      ('assignee_employee_id', 'bigint', 'int8', 'YES', null),
      ('started_at', 'timestamp with time zone', 'timestamptz', 'YES', null),
      ('completed_at', 'timestamp with time zone', 'timestamptz', 'YES', null),
      ('updated_at', 'timestamp with time zone', 'timestamptz', 'NO', 'now()'),
      ('updated_by_employee_id', 'bigint', 'int8', 'YES', null),
      ('previous_phase_id', null, null, null, null)
  ) as expected(column_name, draft_data_type, draft_udt_name, draft_nullable, draft_default)
),
live_columns as (
  select column_name, data_type, udt_name, is_nullable, column_default
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'phases'
)
select
  '16_target_column_conflict_matrix' as section,
  expected.column_name as target_column,
  (live.column_name is not null) as exists_live,
  live.data_type as existing_type,
  live.udt_name as existing_udt_name,
  live.is_nullable as existing_nullable,
  live.column_default as existing_default,
  expected.draft_data_type,
  expected.draft_udt_name,
  expected.draft_nullable,
  expected.draft_default,
  case
    when expected.column_name = 'previous_phase_id' and live.column_name is not null then 'CONFLICT_DEFERRED_FIELD_EXISTS'
    when live.column_name is null then 'NO_CONFLICT_ABSENT'
    when live.udt_name is distinct from expected.draft_udt_name then 'CONFLICT_TYPE'
    when expected.draft_nullable is not null and live.is_nullable is distinct from expected.draft_nullable then 'REVIEW_NULLABILITY'
    else 'NO_CONFLICT_MATCH_OR_REVIEW_DEFAULT'
  end as conflict,
  case
    when expected.column_name = 'previous_phase_id' and live.column_name is not null then 'BLOCK'
    when live.column_name is null then 'ADD_COLUMN'
    when live.udt_name is distinct from expected.draft_udt_name then 'BLOCK'
    else 'REVIEW_AND_KEEP'
  end as action
from expected_columns expected
left join live_columns live on live.column_name = expected.column_name
order by expected.column_name;

with intended_objects as (
  select *
  from (
    values
      ('constraint', 'phases_status_check', 'check status in final vocabulary'),
      ('constraint', 'phases_assignee_employee_id_fkey', 'foreign key assignee_employee_id references employees(id) on update cascade on delete restrict'),
      ('constraint', 'phases_updated_by_employee_id_fkey', 'foreign key updated_by_employee_id references employees(id) on update cascade on delete set null'),
      ('constraint', 'phases_completed_at_status_check', 'check completed status/timestamp consistency, not valid'),
      ('constraint', 'phases_started_completed_order_check', 'check started_at <= completed_at when both present'),
      ('index', 'phases_project_order_unique', 'unique index on phases(project_id, order_index)'),
      ('index', 'phases_project_status_order_idx', 'index on phases(project_id, status, order_index)'),
      ('index', 'phases_assignee_employee_id_idx', 'partial index on assignee_employee_id where not null'),
      ('index', 'phases_deadline_idx', 'partial index on deadline where not null'),
      ('index', 'phases_updated_at_idx', 'index on updated_at'),
      ('trigger', 'phases_set_workflow_audit_fields', 'phase audit trigger executes set_phase_workflow_audit_fields'),
      ('function', 'set_phase_workflow_audit_fields', 'trigger function sets updated_at, default status, updated_by_employee_id from current_employee_id'),
      ('policy', 'phases project access select', 'select to authenticated using can_view_project(project_id)')
  ) as intended(object_type, object_name, intended_definition)
),
live_constraints as (
  select 'constraint' as object_type, con.conname as object_name, pg_get_constraintdef(con.oid, true) as live_definition
  from pg_constraint con
  where con.conrelid = 'public.phases'::regclass
),
live_indexes as (
  select 'index' as object_type, indexname as object_name, indexdef as live_definition
  from pg_indexes
  where schemaname = 'public'
    and tablename = 'phases'
),
live_triggers as (
  select 'trigger' as object_type, t.tgname as object_name, pg_get_triggerdef(t.oid, true) as live_definition
  from pg_trigger t
  where t.tgrelid = 'public.phases'::regclass
    and not t.tgisinternal
),
live_functions as (
  select 'function' as object_type, p.proname as object_name, pg_get_functiondef(p.oid) as live_definition
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'set_phase_workflow_audit_fields'
),
live_policies as (
  select 'policy' as object_type, p.policyname as object_name,
    concat('cmd=', p.cmd, '; roles=', p.roles::text, '; qual=', coalesce(p.qual, ''), '; with_check=', coalesce(p.with_check, '')) as live_definition
  from pg_policies p
  where p.schemaname = 'public'
    and p.tablename = 'phases'
),
live_objects as (
  select * from live_constraints
  union all select * from live_indexes
  union all select * from live_triggers
  union all select * from live_functions
  union all select * from live_policies
)
select
  '17_target_object_conflict_matrix' as section,
  intended.object_type,
  intended.object_name,
  intended.intended_definition,
  (live.object_name is not null) as exists_live,
  live.live_definition,
  case
    when live.object_name is null then false
    when intended.object_type = 'constraint'
      and intended.object_name = 'phases_status_check'
      and live.live_definition ilike all (array['%NOT_STARTED%', '%IN_PROGRESS%', '%REVIEW%', '%BLOCKED%', '%COMPLETED%', '%CANCELLED%'])
      and live.live_definition not ilike all (array['%TODO%', '%DOING%', '%PROCESSING%', '%READY%', '%SKIPPED%'])
      then true
    when intended.object_type = 'index'
      and intended.object_name = 'phases_project_order_unique'
      and live.live_definition ilike '%unique%'
      and live.live_definition ilike '%project_id%'
      and live.live_definition ilike '%order_index%'
      then true
    when intended.object_type = 'index'
      and intended.object_name = 'phases_assignee_employee_id_idx'
      and live.live_definition ilike '%assignee_employee_id%'
      and live.live_definition ilike '%where%'
      then true
    when intended.object_type = 'index'
      and intended.object_name = 'phases_deadline_idx'
      and live.live_definition ilike '%deadline%'
      and live.live_definition ilike '%where%'
      then true
    when intended.object_type = 'index'
      and intended.object_name = 'phases_project_status_order_idx'
      and live.live_definition ilike '%project_id%'
      and live.live_definition ilike '%status%'
      and live.live_definition ilike '%order_index%'
      then true
    when intended.object_type = 'index'
      and intended.object_name = 'phases_updated_at_idx'
      and live.live_definition ilike '%updated_at%'
      then true
    when intended.object_type = 'policy'
      and live.live_definition = 'cmd=SELECT; roles={authenticated}; qual=can_view_project(project_id); with_check='
      then true
    when intended.object_type = 'trigger'
      and live.live_definition ilike '%set_phase_workflow_audit_fields%'
      then true
    when intended.object_type = 'function'
      and live.live_definition ilike '%returns trigger%'
      and live.live_definition ilike '%new.updated_at%'
      and live.live_definition ilike '%current_employee_id%'
      then true
    else false
  end as exact_or_semantic_match,
  case
    when live.object_name is null then 'NO_CONFLICT_ABSENT'
    when intended.object_type = 'constraint'
      and intended.object_name in ('phases_assignee_employee_id_fkey', 'phases_updated_by_employee_id_fkey', 'phases_completed_at_status_check', 'phases_started_completed_order_check')
      then 'REVIEW_EXISTING_CONSTRAINT_SEMANTICS'
    when intended.object_type = 'policy'
      and live.live_definition <> 'cmd=SELECT; roles={authenticated}; qual=can_view_project(project_id); with_check='
      then 'BLOCK_POLICY_NAME_CONFLICT'
    else 'REVIEW_IF_EXISTS'
  end as conflict_risk
from intended_objects intended
left join live_objects live
  on live.object_type = intended.object_type
 and live.object_name = intended.object_name
order by intended.object_type, intended.object_name;

with ordered as (
  select
    phase.id as phase_id,
    phase.project_id,
    phase.order_index,
    count(*) over (partition by phase.project_id, phase.order_index) as same_order_count,
    row_number() over (partition by phase.project_id order by phase.order_index, phase.id) as sequence_number
  from public.phases phase
),
project_flags as (
  select
    project_id,
    bool_or(same_order_count > 1) as has_duplicate_order
  from ordered
  group by project_id
),
preview as (
  select
    ordered.phase_id,
    ordered.project_id,
    ordered.order_index,
    'NOT_STARTED'::text as proposed_status,
    null::timestamptz as proposed_started_at,
    null::bigint as proposed_previous_phase_id,
    null::bigint as proposed_assignee_employee_id,
    null::date as proposed_deadline,
    null::text as proposed_description,
    case
      when project_flags.has_duplicate_order then 'BLOCKED'
      else 'ELIGIBLE'
    end as classification,
    case
      when project_flags.has_duplicate_order then 'duplicate order_index within project'
      else null
    end as blocking_reason
  from ordered
  join project_flags on project_flags.project_id = ordered.project_id
)
select
  '18_backfill_preview_per_phase' as section,
  phase_id,
  project_id,
  order_index,
  proposed_status,
  proposed_started_at,
  proposed_previous_phase_id,
  proposed_assignee_employee_id,
  proposed_deadline,
  proposed_description,
  classification,
  blocking_reason
from preview
order by project_id, order_index, phase_id;

with ordered as (
  select
    phase.id as phase_id,
    phase.project_id,
    phase.order_index,
    count(*) over (partition by phase.project_id, phase.order_index) as same_order_count
  from public.phases phase
),
preview as (
  select
    phase_id,
    project_id,
    'NOT_STARTED'::text as proposed_status,
    case when same_order_count > 1 then 'BLOCKED' else 'ELIGIBLE' end as classification
  from ordered
)
select
  '19_backfill_preview_summary' as section,
  count(*) filter (where classification = 'ELIGIBLE')::bigint as eligible_row_count,
  count(*) filter (where classification = 'BLOCKED')::bigint as blocked_row_count,
  count(distinct project_id)::bigint as project_count,
  count(*) filter (where proposed_status = 'NOT_STARTED')::bigint as expected_not_started_count,
  count(*) filter (where proposed_status = 'IN_PROGRESS')::bigint as expected_in_progress_count,
  count(*) filter (where proposed_status = 'COMPLETED')::bigint as expected_completed_count
from preview;

select
  '20_fk_eligibility' as section,
  'phases.assignee_employee_id -> employees.id' as target_fk,
  phase_id_cols.udt_name as phase_id_udt_name,
  employee_id_cols.udt_name as employee_id_udt_name,
  exists (
    select 1
    from pg_constraint con
    where con.conrelid = 'public.employees'::regclass
      and con.contype in ('p', 'u')
      and con.conkey = array[
        (
          select attnum
          from pg_attribute
          where attrelid = 'public.employees'::regclass
            and attname = 'id'
            and not attisdropped
        )
      ]::smallint[]
  ) as referenced_key_exists,
  (phase_id_cols.udt_name = employee_id_cols.udt_name) as type_compatible,
  'no assignee backfill in foundation' as backfill_note
from information_schema.columns phase_id_cols
join information_schema.columns employee_id_cols
  on employee_id_cols.table_schema = 'public'
 and employee_id_cols.table_name = 'employees'
 and employee_id_cols.column_name = 'id'
where phase_id_cols.table_schema = 'public'
  and phase_id_cols.table_name = 'phases'
  and phase_id_cols.column_name = 'id'
union all
select
  '20_fk_eligibility',
  'phases.updated_by_employee_id -> employees.id',
  phase_id_cols.udt_name,
  employee_id_cols.udt_name,
  exists (
    select 1
    from pg_constraint con
    where con.conrelid = 'public.employees'::regclass
      and con.contype in ('p', 'u')
      and con.conkey = array[
        (
          select attnum
          from pg_attribute
          where attrelid = 'public.employees'::regclass
            and attname = 'id'
            and not attisdropped
        )
      ]::smallint[]
  ),
  (phase_id_cols.udt_name = employee_id_cols.udt_name),
  'no actor backfill in foundation'
from information_schema.columns phase_id_cols
join information_schema.columns employee_id_cols
  on employee_id_cols.table_schema = 'public'
 and employee_id_cols.table_name = 'employees'
 and employee_id_cols.column_name = 'id'
where phase_id_cols.table_schema = 'public'
  and phase_id_cols.table_name = 'phases'
  and phase_id_cols.column_name = 'id';

with phase_policy_snapshot as (
  select
    p.policyname,
    p.cmd,
    p.roles,
    p.qual,
    p.with_check
  from pg_policies p
  where p.schemaname = 'public'
    and p.tablename = 'phases'
),
project_policy_snapshot as (
  select
    p.policyname,
    p.cmd,
    p.roles,
    p.qual,
    p.with_check
  from pg_policies p
  where p.schemaname = 'public'
    and p.tablename = 'projects'
)
select
  '21_rls_regression_snapshot_phases' as section,
  policyname,
  cmd,
  roles,
  qual,
  with_check
from phase_policy_snapshot
union all
select
  '22_rls_regression_snapshot_projects',
  policyname,
  cmd,
  roles,
  qual,
  with_check
from project_policy_snapshot
order by section, policyname;

select
  '23_rls_regression_summary' as section,
  count(*) filter (where cls.relname = 'phases' and pol.polcmd = '*')::bigint as phase_policy_all_count,
  count(*) filter (where cls.relname = 'phases' and 'anon'::regrole = any(pol.polroles))::bigint as phase_anon_policy_count,
  count(*) filter (where cls.relname = 'phases' and pol.polcmd in ('a', 'w', 'd'))::bigint as phase_mutation_policy_count,
  count(*) filter (where cls.relname = 'phases' and pol.polcmd = 'r' and pg_get_expr(pol.polqual, pol.polrelid) in ('true', '(true)'))::bigint as phase_broad_select_count,
  count(*) filter (where cls.relname = 'projects' and pol.polname = 'projects project access select')::bigint as project_read_policy_count
from pg_policy pol
join pg_class cls on cls.oid = pol.polrelid
join pg_namespace ns on ns.oid = cls.relnamespace
where ns.nspname = 'public'
  and cls.relname in ('phases', 'projects');
