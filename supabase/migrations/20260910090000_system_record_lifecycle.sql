-- Adds reversible lifecycle state without changing existing rows or browser grants.
alter table public.email_templates
  add column if not exists is_active boolean not null default true,
  add column if not exists deactivated_at timestamptz,
  add column if not exists deactivated_by_employee_id bigint;

alter table public.system_metadata
  add column if not exists is_active boolean not null default true,
  add column if not exists deactivated_at timestamptz,
  add column if not exists deactivated_by_employee_id bigint;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'email_templates_deactivated_by_employee_fk' and conrelid = 'public.email_templates'::regclass) then
    alter table public.email_templates add constraint email_templates_deactivated_by_employee_fk
      foreign key (deactivated_by_employee_id) references public.employees(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'system_metadata_deactivated_by_employee_fk' and conrelid = 'public.system_metadata'::regclass) then
    alter table public.system_metadata add constraint system_metadata_deactivated_by_employee_fk
      foreign key (deactivated_by_employee_id) references public.employees(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'email_templates_lifecycle_consistent' and conrelid = 'public.email_templates'::regclass) then
    alter table public.email_templates add constraint email_templates_lifecycle_consistent check (
      (is_active and deactivated_at is null and deactivated_by_employee_id is null)
      or (not is_active and deactivated_at is not null)
    );
  end if;
  if not exists (select 1 from pg_constraint where conname = 'system_metadata_lifecycle_consistent' and conrelid = 'public.system_metadata'::regclass) then
    alter table public.system_metadata add constraint system_metadata_lifecycle_consistent check (
      (is_active and deactivated_at is null and deactivated_by_employee_id is null)
      or (not is_active and deactivated_at is not null)
    );
  end if;
end $$;

create index if not exists email_templates_active_id_idx
  on public.email_templates (id desc) where is_active;
create index if not exists system_metadata_active_name_idx
  on public.system_metadata (name) where is_active;

comment on column public.email_templates.is_active is 'Whether this template is available for new operational use.';
comment on column public.system_metadata.is_active is 'Whether this metadata category is available for new operational use.';
