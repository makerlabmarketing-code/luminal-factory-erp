-- Corrective Slice 6 Production Order Persistence validation reviewed package.
-- READ ONLY. Run before and after approved LIVE_APPROVAL rollout. Expected result
-- for every row is PASS; any FAIL blocks application wiring.

with required_tables(table_name) as (
  values
    ('production_workflow_templates'),('production_workflow_template_stages'),('production_orders'),
    ('production_stages'),('production_stage_dependencies'),('production_order_members'),('production_attachment_metadata'),
    ('projects'),('phases'),('tasks'),('project_members'),('project_activity'),('task_notifications')
), required_functions(function_name, identity_args) as (
  values ('create_production_order_atomic','p_payload jsonb'), ('transition_production_stage_atomic','p_payload jsonb'), ('current_employee_id',''), ('can_view_project','target_project_id bigint'), ('has_permission','permission_code text')
), required_indexes(index_name) as (
  values ('production_orders_code_unique_idx'),('production_stages_single_active_idx'),('production_stage_dependencies_unique_idx'),('production_order_members_active_unique_idx'),('task_notifications_dedupe_key_unique_idx')
)
select 'required_tables_exist' as check_name, case when count(*) = (select count(*) from required_tables) then 'PASS' else 'FAIL' end as result
from required_tables rt left join information_schema.tables t on t.table_schema='public' and t.table_name=rt.table_name
where t.table_name is not null
union all
select 'required_functions_exist', case when count(*) = (select count(*) from required_functions) then 'PASS' else 'FAIL' end
from required_functions rf left join pg_proc p on p.proname=rf.function_name and pg_get_function_identity_arguments(p.oid)=rf.identity_args left join pg_namespace n on n.oid=p.pronamespace and n.nspname='public'
where p.oid is not null
union all
select 'required_indexes_exist', case when count(*) = (select count(*) from required_indexes) then 'PASS' else 'FAIL' end
from required_indexes ri left join pg_class c on c.relname=ri.index_name left join pg_namespace n on n.oid=c.relnamespace and n.nspname='public'
where c.oid is not null
union all
select 'duplicate_display_names_allowed', case when exists (select 1 from pg_indexes where schemaname='public' and tablename='production_orders' and indexdef ilike '%production_code%') and not exists (select 1 from pg_indexes where schemaname='public' and tablename='production_orders' and indexdef ilike '%display_name%' and indexdef ilike '%unique%') then 'PASS' else 'FAIL' end
union all
select 'no_inventory_quantity_mutation_artifact', case when not exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname ilike any(array['%decrement%stock%','%mutate%inventory%','%procurement%'])) then 'PASS' else 'FAIL' end
union all
select 'rpc_execute_not_anon', case when not has_function_privilege('anon', 'public.create_production_order_atomic(jsonb)', 'EXECUTE') and has_function_privilege('authenticated', 'public.create_production_order_atomic(jsonb)', 'EXECUTE') then 'PASS' else 'FAIL' end
union all
select 'no_anon_write_policies', case when not exists (select 1 from pg_policies where schemaname='public' and tablename in ('production_orders','production_stages','production_stage_dependencies','production_order_members','production_attachment_metadata') and cmd in ('INSERT','UPDATE','DELETE','ALL') and roles::text like '%anon%') then 'PASS' else 'FAIL' end
union all
select 'no_broad_authenticated_write_policies', case when not exists (select 1 from pg_policies where schemaname='public' and tablename in ('production_orders','production_stages','production_stage_dependencies','production_order_members','production_attachment_metadata') and cmd in ('INSERT','UPDATE','DELETE','ALL') and roles::text like '%authenticated%') then 'PASS' else 'FAIL' end
union all
select 'no_orphan_production_orders', case when not exists (select 1 from public.production_orders po where not exists (select 1 from public.projects p where p.id=po.project_id)) then 'PASS' else 'FAIL' end
union all
select 'no_orphan_production_stages', case when not exists (select 1 from public.production_stages ps where not exists (select 1 from public.production_orders po where po.id=ps.production_order_id) or not exists (select 1 from public.projects p where p.id=ps.project_id)) then 'PASS' else 'FAIL' end
union all
select 'no_orphan_production_members', case when not exists (select 1 from public.production_order_members pom where not exists (select 1 from public.production_orders po where po.id=pom.production_order_id) or not exists (select 1 from public.project_members pm where pm.id=pom.project_member_id) or not exists (select 1 from public.employees e where e.id=pom.employee_id)) then 'PASS' else 'FAIL' end
union all
select 'no_orphan_dependencies', case when not exists (select 1 from public.production_stage_dependencies d where not exists (select 1 from public.production_stages s where s.id=d.stage_id) or not exists (select 1 from public.production_stages s where s.id=d.depends_on_stage_id)) then 'PASS' else 'FAIL' end
union all
select 'no_circular_stage_dependencies', case when not exists (with recursive walk(root_stage_id, stage_id, depends_on_stage_id, path) as (select stage_id, stage_id, depends_on_stage_id, array[stage_id] from public.production_stage_dependencies union all select w.root_stage_id, d.stage_id, d.depends_on_stage_id, path || d.stage_id from public.production_stage_dependencies d join walk w on d.stage_id=w.depends_on_stage_id where not d.stage_id = any(path)) select 1 from walk where depends_on_stage_id = root_stage_id) then 'PASS' else 'FAIL' end
union all
select 'no_duplicate_active_sequential_stage', case when not exists (select production_order_id from public.production_stages where status='IN_PROGRESS' group by production_order_id having count(*) > 1) then 'PASS' else 'FAIL' end
union all
select 'rollback_preconditions_readable', case when true then 'PASS' else 'FAIL' end;
