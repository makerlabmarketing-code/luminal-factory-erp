-- Restores the prior buggy behavior; emergency rollback only.
begin;
create or replace function public.has_permission(permission_code text)
returns boolean
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select
    public.current_employee_id() is not null
    and exists (
      select 1
      from public.permissions p
      where p.code = permission_code
    )
    and not exists (
      select 1
      from public.employee_permissions ep
      where ep.employee_id = public.current_employee_id()
        and ep.permission_code = permission_code
        and ep.effect = 'DENY'
        and ep.status = 'ACTIVE'
        and ep.revoked_at is null
    )
    and exists (
      select 1
      from public.employee_permissions ep
      where ep.employee_id = public.current_employee_id()
        and ep.permission_code = permission_code
        and ep.effect = 'ALLOW'
        and ep.status = 'ACTIVE'
        and ep.revoked_at is null
    );
$$;
commit;
