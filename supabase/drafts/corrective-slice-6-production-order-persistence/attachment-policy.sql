-- Corrective Slice 6 attachment metadata policy reviewed package.
-- DRAFT ONLY - DO NOT RUN WITHOUT LIVE_APPROVAL_REQUIRED.
-- This package stores protected metadata only. It does not create public storage
-- buckets, public object policies, signed URLs, or direct browser write access.

begin;

alter table public.production_attachment_metadata enable row level security;
revoke all on public.production_attachment_metadata from public, anon, authenticated;
grant select on public.production_attachment_metadata to authenticated;

create policy "production attachment metadata project select"
  on public.production_attachment_metadata
  for select
  to authenticated
  using (
    exists (
      select 1 from public.production_orders po
      where po.id = production_order_id and public.can_view_project(po.project_id)
    )
  );

comment on table public.production_attachment_metadata is 'Protected production attachment metadata. Storage object access remains private and must be mediated by approved server routes.';

commit;
