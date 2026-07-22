-- Corrective Slice 6 compatibility layer reviewed package.
-- DRAFT ONLY - DO NOT RUN WITHOUT LIVE_APPROVAL_REQUIRED.
-- Read-only compatibility views keep application reads aligned with existing
-- project/phase/task/member/activity/notification structures.

begin;

create or replace view public.production_order_list_view
with (security_invoker = true)
as
select
  po.id as production_order_id,
  po.production_code,
  po.display_name,
  po.project_id,
  p.name as project_name,
  po.product_or_collection,
  po.colorway,
  po.planned_quantity,
  po.completed_quantity,
  po.priority,
  po.status,
  po.current_stage_id,
  current_stage.name as current_stage_name,
  po.target_completion_date,
  po.project_manager_employee_id,
  po.creative_lead_employee_id,
  po.created_by_employee_id,
  po.created_at,
  po.updated_at
from public.production_orders po
join public.projects p on p.id = po.project_id
left join public.production_stages current_stage on current_stage.id = po.current_stage_id;

create or replace view public.production_order_detail_view
with (security_invoker = true)
as
select
  po.*,
  coalesce(jsonb_agg(distinct jsonb_build_object('id', ps.id, 'stageKey', ps.stage_key, 'name', ps.name, 'sequence', ps.sequence, 'status', ps.status, 'phaseId', ps.phase_id, 'progress', ps.progress, 'requiresReview', ps.requires_review, 'reviewStatus', ps.review_status)) filter (where ps.id is not null), '[]'::jsonb) as stages,
  coalesce(jsonb_agg(distinct jsonb_build_object('employeeId', pom.employee_id, 'role', pom.production_role, 'active', pom.is_active)) filter (where pom.id is not null), '[]'::jsonb) as members
from public.production_orders po
left join public.production_stages ps on ps.production_order_id = po.id
left join public.production_order_members pom on pom.production_order_id = po.id
group by po.id;

revoke all on public.production_order_list_view from public, anon;
revoke all on public.production_order_detail_view from public, anon;
grant select on public.production_order_list_view to authenticated;
grant select on public.production_order_detail_view to authenticated;

commit;
