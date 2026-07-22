-- Corrective Slice 6 Production Order Persistence RLS reviewed package.
-- DRAFT ONLY - DO NOT RUN WITHOUT LIVE_APPROVAL_REQUIRED.
-- No anonymous or broad browser write policies are introduced. Mutations use
-- approved server/RPC boundaries after permission, membership, and workflow gates.

begin;

alter table public.production_workflow_templates enable row level security;
alter table public.production_workflow_template_stages enable row level security;
alter table public.production_orders enable row level security;
alter table public.production_stages enable row level security;
alter table public.production_stage_dependencies enable row level security;
alter table public.production_order_members enable row level security;
alter table public.production_attachment_metadata enable row level security;

revoke all on public.production_workflow_templates from public, anon, authenticated;
revoke all on public.production_workflow_template_stages from public, anon, authenticated;
revoke all on public.production_orders from public, anon, authenticated;
revoke all on public.production_stages from public, anon, authenticated;
revoke all on public.production_stage_dependencies from public, anon, authenticated;
revoke all on public.production_order_members from public, anon, authenticated;
revoke all on public.production_attachment_metadata from public, anon, authenticated;

grant select on public.production_workflow_templates to authenticated;
grant select on public.production_workflow_template_stages to authenticated;
grant select on public.production_orders to authenticated;
grant select on public.production_stages to authenticated;
grant select on public.production_stage_dependencies to authenticated;
grant select on public.production_order_members to authenticated;
grant select on public.production_attachment_metadata to authenticated;

create policy "production templates authorized select" on public.production_workflow_templates for select to authenticated using (
  public.has_workspace_access('ADMIN_WORKSPACE') and (public.has_permission('PROJECT_VIEW') or public.has_permission('TASK_VIEW'))
);
create policy "production template stages authorized select" on public.production_workflow_template_stages for select to authenticated using (
  exists (select 1 from public.production_workflow_templates t where t.id = template_id and public.has_workspace_access('ADMIN_WORKSPACE') and (public.has_permission('PROJECT_VIEW') or public.has_permission('TASK_VIEW')))
);
create policy "production orders project access select" on public.production_orders for select to authenticated using (public.can_view_project(project_id));
create policy "production stages project access select" on public.production_stages for select to authenticated using (public.can_view_project(project_id));
create policy "production dependencies project access select" on public.production_stage_dependencies for select to authenticated using (
  exists (select 1 from public.production_orders po where po.id = production_order_id and public.can_view_project(po.project_id))
);
create policy "production members project access select" on public.production_order_members for select to authenticated using (
  exists (select 1 from public.production_orders po where po.id = production_order_id and public.can_view_project(po.project_id))
);
create policy "production attachments project access select" on public.production_attachment_metadata for select to authenticated using (
  exists (select 1 from public.production_orders po where po.id = production_order_id and public.can_view_project(po.project_id))
);

revoke all on function public.create_production_order_atomic(jsonb) from public, anon;
revoke all on function public.transition_production_stage_atomic(jsonb) from public, anon;
grant execute on function public.create_production_order_atomic(jsonb) to authenticated;
grant execute on function public.transition_production_stage_atomic(jsonb) to authenticated;

comment on policy "production orders project access select" on public.production_orders is 'Staff read only production work visible through existing project membership and PROJECT/TASK view helpers.';
comment on function public.create_production_order_atomic(jsonb) is 'Corrective Slice 6 reviewed RPC. SECURITY DEFINER uses server-derived auth.uid/current_employee_id, PROJECT_MANAGE, TASK_MANAGE, active employee, and project membership gates.';

commit;
