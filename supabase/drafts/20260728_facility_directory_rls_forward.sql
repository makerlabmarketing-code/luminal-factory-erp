-- DRAFT ONLY. Operator-reviewed Facility Directory read boundary.
-- This adds no write policy and does not modify facility or employee data.
begin;

do $$
begin
  if to_regclass('public.facilities') is null then
    raise exception 'Precondition failed: public.facilities does not exist.';
  end if;
  if to_regprocedure('public.has_workspace_access(text)') is null
     or to_regprocedure('public.has_permission(text)') is null then
    raise exception 'Precondition failed: authorization helper functions do not exist.';
  end if;
end $$;

grant select on public.facilities to authenticated;
alter table public.facilities enable row level security;

drop policy if exists "facilities authorized directory select" on public.facilities;
create policy "facilities authorized directory select"
on public.facilities
for select
to authenticated
using (
  (
    public.has_workspace_access('ADMIN_WORKSPACE')
    and (
      public.has_permission('SYSTEM_SETTINGS_VIEW')
      or public.has_permission('ATTENDANCE_MANAGE')
      or public.has_permission('EMPLOYEE_VIEW')
    )
  )
  or public.has_workspace_access('STAFF_WORKSPACE')
);

comment on policy "facilities authorized directory select" on public.facilities is
  'Read-only Facility Directory access for authorized Admin workflows and Staff attendance; writes remain server-gated.';

commit;
