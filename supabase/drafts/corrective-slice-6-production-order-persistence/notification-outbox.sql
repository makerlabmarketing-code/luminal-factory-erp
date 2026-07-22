-- Corrective Slice 6 notification outbox integration reviewed package.
-- DRAFT ONLY - DO NOT RUN WITHOUT LIVE_APPROVAL_REQUIRED.
-- Reuses public.task_notifications; no parallel notification system is created.

begin;

alter table public.task_notifications
  add column if not exists production_order_id uuid references public.production_orders(id) on delete cascade,
  add column if not exists production_stage_id uuid references public.production_stages(id) on delete set null,
  add column if not exists dedupe_key text;

create unique index if not exists task_notifications_dedupe_key_unique_idx
  on public.task_notifications(dedupe_key) where dedupe_key is not null;

create index if not exists task_notifications_production_order_idx
  on public.task_notifications(production_order_id, status, created_at desc)
  where production_order_id is not null;

comment on column public.task_notifications.dedupe_key is 'Idempotency key for task and production workflow notification outbox writes.';
comment on column public.task_notifications.production_order_id is 'Optional production-order context for notifications emitted through the existing task notification outbox.';

commit;
