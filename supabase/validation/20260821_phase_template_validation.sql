-- Read-only post-run validation for Phase Template release one.

begin transaction read only;

select '01 relations' as check_name,
  count(*) = 6 as passed
from pg_class relation
join pg_namespace namespace on namespace.oid = relation.relnamespace
where namespace.nspname = 'public'
  and relation.relname in ('phase_templates', 'phase_template_versions', 'phase_template_stages',
    'phase_template_tasks', 'phase_template_applications', 'phase_template_audit');

select '02 permission catalog' as check_name,
  count(*) = 1 as passed
from public.permissions where code = 'PHASE_TEMPLATE_MANAGE';

select '02b approved source columns' as check_name,
  count(*) = 3 as passed
from information_schema.columns
where table_schema = 'public'
  and (table_name, column_name, data_type) in (
    ('projects', 'start_date', 'date'),
    ('tasks', 'is_required', 'boolean'),
    ('tasks', 'requires_review', 'boolean')
  );

select '03 empty initial catalog' as check_name,
  (select count(*) from public.phase_templates) = 0
  and (select count(*) from public.phase_template_versions) = 0
  and (select count(*) from public.phase_template_stages) = 0
  and (select count(*) from public.phase_template_tasks) = 0 as passed;

select '04 rls enabled' as check_name,
  count(*) = 6 and bool_and(relation.relrowsecurity) as passed
from pg_class relation
join pg_namespace namespace on namespace.oid = relation.relnamespace
where namespace.nspname = 'public'
  and relation.relname in ('phase_templates', 'phase_template_versions', 'phase_template_stages',
    'phase_template_tasks', 'phase_template_applications', 'phase_template_audit');

select '05 no browser writes' as check_name,
  count(*) = 0 as passed
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name like 'phase_template%'
  and grantee in ('PUBLIC', 'anon', 'authenticated')
  and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'TRIGGER', 'REFERENCES');

select '06 anon has no access' as check_name,
  count(*) = 0 as passed
from information_schema.role_table_grants
where table_schema = 'public' and table_name like 'phase_template%' and grantee = 'anon';

select '07 required indexes and constraints' as check_name,
  count(*) filter (where indexname in (
    'phase_template_versions_one_draft_idx', 'phase_template_versions_one_published_idx',
    'phase_template_stages_version_idx', 'phase_template_tasks_stage_idx',
    'phase_template_applications_template_idx', 'phase_template_applications_version_idx',
    'phase_template_audit_template_time_idx', 'phase_template_audit_retention_idx'
  )) = 8 as passed
from pg_indexes where schemaname = 'public';

select '08 lifecycle and immutable triggers' as check_name,
  count(*) = 5 as passed
from pg_trigger trigger
where not trigger.tgisinternal and trigger.tgname in (
  'phase_template_applications_immutable', 'phase_template_audit_immutable',
  'phase_template_stages_draft_only', 'phase_template_tasks_draft_only',
  'phase_templates_current_version_guard'
);

select '09 source rows unchanged' as check_name,
  (select count(*) from public.projects) as project_count,
  (select count(*) from public.phases) as phase_count,
  (select count(*) from public.tasks) as task_count;

select '10 function security' as check_name,
  procedure.proname,
  procedure.prosecdef as security_definer,
  procedure.proconfig as function_config,
  has_function_privilege('anon', procedure.oid, 'EXECUTE') as anon_execute,
  has_function_privilege('authenticated', procedure.oid, 'EXECUTE') as authenticated_execute,
  has_function_privilege('service_role', procedure.oid, 'EXECUTE') as service_role_execute
from pg_proc procedure
join pg_namespace namespace on namespace.oid = procedure.pronamespace
where namespace.nspname = 'public'
  and procedure.oid in (
    'public.create_project_atomic(jsonb)'::regprocedure,
    'public.manage_phase_template_atomic(jsonb)'::regprocedure
  )
order by procedure.proname;

select '11 atomic template contract' as check_name,
  pg_get_functiondef('public.create_project_atomic(jsonb)'::regprocedure) like '%templateVersionId%' as accepts_template_version,
  pg_get_functiondef('public.create_project_atomic(jsonb)'::regprocedure) like '%template_start_date_required%' as requires_start_date,
  pg_get_functiondef('public.create_project_atomic(jsonb)'::regprocedure) like '%template_deadline_overflow%' as rejects_deadline_overflow,
  pg_get_functiondef('public.create_project_atomic(jsonb)'::regprocedure) like '%phase_template_applications%' as writes_provenance,
  pg_get_functiondef('public.create_project_atomic(jsonb)'::regprocedure) like '%phase_template_audit%' as writes_audit;

select '12 lifecycle integrity' as check_name,
  not exists (
    select 1 from public.phase_templates template
    left join public.phase_template_versions version on version.id = template.current_version_id
    where template.current_version_id is not null
      and (version.template_id <> template.id or version.status <> 'PUBLISHED')
  ) as current_version_valid,
  not exists (
    select 1 from public.phase_template_applications application
    join public.phase_template_versions version on version.id = application.version_id
    where version.template_id <> application.template_id
  ) as application_version_matches_template,
  not exists (
    select 1 from public.phase_template_stages stage
    group by stage.version_id
    having min(stage.order_index) <> 1 or max(stage.order_index) <> count(*)
  ) as stage_order_contiguous,
  not exists (
    select 1 from public.phase_template_tasks task
    group by task.stage_id
    having min(task.order_index) <> 1 or max(task.order_index) <> count(*)
  ) as task_order_contiguous;

rollback;
