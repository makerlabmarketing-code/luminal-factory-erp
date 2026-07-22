-- Corrective Slice 6 Production Order Persistence rollback reviewed package.
-- DRAFT ONLY - DO NOT RUN WITHOUT LIVE_APPROVAL_REQUIRED.
-- Rollback is destructive for Slice 6 objects and must run only when validation
-- confirms no production orders, stages, members, dependencies, attachments,
-- project activity, or notifications need preservation.

begin;

do $$
begin
  if to_regclass('public.production_orders') is not null and exists (select 1 from public.production_orders limit 1) then
    raise exception 'Rollback blocked: production_orders contains operational rows.';
  end if;
  if to_regclass('public.production_attachment_metadata') is not null and exists (select 1 from public.production_attachment_metadata limit 1) then
    raise exception 'Rollback blocked: production_attachment_metadata contains operational rows.';
  end if;
  if to_regclass('public.task_notifications') is not null and exists (select 1 from public.task_notifications where production_order_id is not null or production_stage_id is not null limit 1) then
    raise exception 'Rollback blocked: production notification outbox rows exist.';
  end if;
  if to_regclass('public.project_activity') is not null and exists (select 1 from public.project_activity where production_order_id is not null or production_stage_id is not null limit 1) then
    raise exception 'Rollback blocked: production activity rows exist.';
  end if;
end $$;

revoke all on function public.create_production_order_atomic(jsonb) from public, anon, authenticated;
revoke all on function public.transition_production_stage_atomic(jsonb) from public, anon, authenticated;
drop function if exists public.create_production_order_atomic(jsonb);
drop function if exists public.transition_production_stage_atomic(jsonb);

drop view if exists public.production_order_detail_view;
drop view if exists public.production_order_list_view;

drop trigger if exists detect_production_stage_dependency_cycle on public.production_stage_dependencies;
drop trigger if exists set_production_workflow_templates_updated_at on public.production_workflow_templates;
drop trigger if exists set_production_orders_updated_at on public.production_orders;
drop trigger if exists set_production_stages_updated_at on public.production_stages;
drop trigger if exists set_production_order_members_updated_at on public.production_order_members;

drop table if exists public.production_attachment_metadata;
drop table if exists public.production_stage_dependencies;
drop table if exists public.production_order_members;
alter table if exists public.production_orders drop constraint if exists production_orders_current_stage_fkey;
drop table if exists public.production_stages;
drop table if exists public.production_orders;
drop table if exists public.production_workflow_template_stages;
drop table if exists public.production_workflow_templates;

drop function if exists public.detect_production_stage_dependency_cycle();
drop function if exists public.set_production_updated_at();

alter table if exists public.task_notifications drop column if exists production_order_id;
alter table if exists public.task_notifications drop column if exists production_stage_id;
alter table if exists public.task_notifications drop column if exists dedupe_key;
alter table if exists public.project_activity drop column if exists production_order_id;
alter table if exists public.project_activity drop column if exists production_stage_id;
alter table if exists public.project_activity drop constraint if exists project_activity_activity_type_check;
alter table if exists public.project_activity add constraint project_activity_activity_type_check check (activity_type in ('TASK_CREATED','TASK_UPDATED','TASK_ASSIGNED','STATUS_CHANGED','COMMENT_ADDED'));

commit;
