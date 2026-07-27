-- Read-only validation for
-- 20260722110928_corrective_slice_6_production_order_persistence.sql.

select
  to_regclass('public.production_workflow_templates') is not null as production_workflow_templates_present,
  to_regclass('public.production_workflow_template_stages') is not null as production_workflow_template_stages_present,
  to_regclass('public.production_orders') is not null as production_orders_present,
  to_regclass('public.production_stages') is not null as production_stages_present,
  to_regclass('public.production_stage_dependencies') is not null as production_stage_dependencies_present,
  to_regclass('public.production_order_members') is not null as production_order_members_present,
  to_regclass('public.production_attachment_metadata') is not null as production_attachment_metadata_present;

select
  to_regprocedure('public.create_production_order_atomic(jsonb)') is not null
    as create_production_order_atomic_present,
  to_regprocedure('public.transition_production_stage_atomic(jsonb)') is not null
    as transition_production_stage_atomic_present;

select
  count(*) = 8 as production_select_policies_present
from pg_policies
where schemaname = 'public'
  and policyname in (
    'production attachment metadata project select',
    'production templates authorized select',
    'production template stages authorized select',
    'production orders project access select',
    'production stages project access select',
    'production dependencies project access select',
    'production members project access select',
    'production attachments project access select'
  );
