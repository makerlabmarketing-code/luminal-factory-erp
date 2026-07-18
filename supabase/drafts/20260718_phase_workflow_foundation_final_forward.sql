-- DRAFT ONLY - DO NOT RUN WITHOUT EXPLICIT APPROVAL.
-- Phase Workflow Foundation final forward migration draft.
--
-- Replacement authority for:
-- - 20260704153000_move_workflow_to_project_tables.sql
-- - 20260709110000_add_colorway_stage_fields.sql, for phase workflow fields only
--
-- Scope:
-- - Add minimal workflow metadata to public.phases.
-- - Add phase read RLS using existing public.can_view_project(bigint).
-- - Keep phase mutation behind the approved server boundary.
--
-- Explicit non-scope:
-- - No task schema changes.
-- - No project_members row changes.
-- - No financial, attendance, auth, or employee data changes.
-- - No comments, progress, reviewer, activity log, template, colorway, or task assignment fields.
-- - No browser INSERT/UPDATE/DELETE policy.

begin;

do $$
begin
  if to_regclass('public.projects') is null then
    raise exception 'Precondition failed: public.projects does not exist.';
  end if;

  if to_regclass('public.phases') is null then
    raise exception 'Precondition failed: public.phases does not exist.';
  end if;

  if to_regclass('public.employees') is null then
    raise exception 'Precondition failed: public.employees does not exist.';
  end if;

  if to_regclass('public.project_members') is null then
    raise exception 'Precondition failed: public.project_members does not exist.';
  end if;

  if to_regprocedure('public.current_employee_id()') is null then
    raise exception 'Precondition failed: public.current_employee_id() does not exist.';
  end if;

  if to_regprocedure('public.can_view_project(bigint)') is null then
    raise exception 'Precondition failed: public.can_view_project(bigint) does not exist.';
  end if;

  if exists (
    select 1
    from public.phases
    where project_id is null
  ) then
    raise exception 'Precondition failed: public.phases has null project_id rows.';
  end if;

  if exists (
    select 1
    from public.phases phase
    left join public.projects project on project.id = phase.project_id
    where project.id is null
  ) then
    raise exception 'Precondition failed: public.phases has orphan project_id rows.';
  end if;

  if exists (
    select 1
    from public.phases
    group by project_id, order_index
    having count(*) > 1
  ) then
    raise exception 'Precondition failed: duplicate phase order_index within a project.';
  end if;
end $$;

alter table public.phases
  add column if not exists description text,
  add column if not exists status text,
  add column if not exists deadline date,
  add column if not exists assignee_employee_id bigint,
  add column if not exists started_at timestamptz,
  add column if not exists completed_at timestamptz,
  add column if not exists updated_at timestamptz,
  add column if not exists updated_by_employee_id bigint;

do $$
begin
  if exists (
    select 1
    from public.phases
    where status is not null
      and status not in (
        'NOT_STARTED',
        'IN_PROGRESS',
        'REVIEW',
        'BLOCKED',
        'COMPLETED',
        'CANCELLED'
      )
  ) then
    raise exception 'Precondition failed: existing public.phases.status contains unapproved values.';
  end if;

  update public.phases
  set status = 'NOT_STARTED'
  where status is null;

  update public.phases
  set updated_at = now()
  where updated_at is null;

  alter table public.phases
    alter column status set default 'NOT_STARTED',
    alter column status set not null,
    alter column updated_at set default now(),
    alter column updated_at set not null;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'phases_status_check'
      and conrelid = 'public.phases'::regclass
  ) then
    alter table public.phases
      add constraint phases_status_check
      check (status in (
        'NOT_STARTED',
        'IN_PROGRESS',
        'REVIEW',
        'BLOCKED',
        'COMPLETED',
        'CANCELLED'
      ));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'phases_assignee_employee_id_fkey'
      and conrelid = 'public.phases'::regclass
  ) then
    alter table public.phases
      add constraint phases_assignee_employee_id_fkey
      foreign key (assignee_employee_id)
      references public.employees(id)
      on update cascade
      on delete restrict;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'phases_updated_by_employee_id_fkey'
      and conrelid = 'public.phases'::regclass
  ) then
    alter table public.phases
      add constraint phases_updated_by_employee_id_fkey
      foreign key (updated_by_employee_id)
      references public.employees(id)
      on update cascade
      on delete set null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'phases_completed_at_status_check'
      and conrelid = 'public.phases'::regclass
  ) then
    alter table public.phases
      add constraint phases_completed_at_status_check
      check (
        (status = 'COMPLETED' and completed_at is not null)
        or (status <> 'COMPLETED' and completed_at is null)
      ) not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'phases_started_completed_order_check'
      and conrelid = 'public.phases'::regclass
  ) then
    alter table public.phases
      add constraint phases_started_completed_order_check
      check (
        started_at is null
        or completed_at is null
        or started_at <= completed_at
      );
  end if;
end $$;

create unique index if not exists phases_project_order_unique
  on public.phases(project_id, order_index);

create index if not exists phases_project_status_order_idx
  on public.phases(project_id, status, order_index);

create index if not exists phases_assignee_employee_id_idx
  on public.phases(assignee_employee_id)
  where assignee_employee_id is not null;

create index if not exists phases_deadline_idx
  on public.phases(deadline)
  where deadline is not null;

create index if not exists phases_updated_at_idx
  on public.phases(updated_at);

create or replace function public.set_phase_workflow_audit_fields()
returns trigger
language plpgsql
set search_path = public, auth, pg_temp
as $$
declare
  actor_employee_id bigint;
begin
  new.updated_at := now();

  if new.status is null then
    new.status := 'NOT_STARTED';
  end if;

  if new.updated_by_employee_id is null then
    actor_employee_id := public.current_employee_id();

    if actor_employee_id is not null then
      new.updated_by_employee_id := actor_employee_id;
    end if;
  end if;

  return new;
end;
$$;

alter function public.set_phase_workflow_audit_fields() owner to postgres;

revoke all on function public.set_phase_workflow_audit_fields() from public;
revoke all on function public.set_phase_workflow_audit_fields() from anon;
revoke all on function public.set_phase_workflow_audit_fields() from authenticated;

drop trigger if exists phases_set_workflow_audit_fields on public.phases;
create trigger phases_set_workflow_audit_fields
before insert or update on public.phases
for each row
execute function public.set_phase_workflow_audit_fields();

alter table public.phases enable row level security;

revoke all on public.phases from public;
revoke all on public.phases from anon;
revoke all on public.phases from authenticated;
grant select on public.phases to authenticated;

drop policy if exists "phases project access select" on public.phases;
create policy "phases project access select"
on public.phases
for select
to authenticated
using (public.can_view_project(project_id));

comment on column public.phases.description is
  'Optional phase description. Not a comment or activity history field.';
comment on column public.phases.status is
  'Phase workflow state. Generic PATCH must not accept this field; use a transition endpoint.';
comment on column public.phases.deadline is
  'Optional date-level phase deadline. Display in the application timezone.';
comment on column public.phases.assignee_employee_id is
  'Optional phase assignee. Server must validate ACTIVE employee and ACTIVE project membership before assignment.';
comment on column public.phases.started_at is
  'Server-controlled timestamp set when a phase first moves to IN_PROGRESS.';
comment on column public.phases.completed_at is
  'Server-controlled timestamp set when a phase moves to COMPLETED.';
comment on column public.phases.updated_at is
  'Optimistic concurrency token maintained by phases_set_workflow_audit_fields.';
comment on column public.phases.updated_by_employee_id is
  'Last actor employee id. Browser clients cannot mutate phases directly.';
comment on function public.set_phase_workflow_audit_fields() is
  'Maintains phase updated_at and, when session context is available, updated_by_employee_id.';
comment on policy "phases project access select" on public.phases is
  'Allows authenticated users to read phases only for projects they can view.';

notify pgrst, 'reload schema';

commit;
