do $$
begin
  if exists (select 1 from public.email_templates where is_active is false)
    or exists (select 1 from public.system_metadata where is_active is false) then
    raise exception 'Rollback blocked: inactive system records exist; export or reactivate them before dropping lifecycle state.';
  end if;
end $$;

drop index if exists public.email_templates_active_id_idx;
drop index if exists public.system_metadata_active_name_idx;

alter table public.email_templates
  drop constraint if exists email_templates_lifecycle_consistent,
  drop constraint if exists email_templates_deactivated_by_employee_fk,
  drop column if exists deactivated_by_employee_id,
  drop column if exists deactivated_at,
  drop column if exists is_active;

alter table public.system_metadata
  drop constraint if exists system_metadata_lifecycle_consistent,
  drop constraint if exists system_metadata_deactivated_by_employee_fk,
  drop column if exists deactivated_by_employee_id,
  drop column if exists deactivated_at,
  drop column if exists is_active;
