-- Project Read RLS rollout.
--
-- Scope:
-- - Create project access helper functions required for SELECT.
-- - Replace missing projects SELECT policy with least-privilege project read.
--
-- This draft intentionally does not:
-- - Modify data.
-- - Modify project_members rows.
-- - Modify phases, tasks, staff_tasks, employees, attendance, or finance.
-- - Create write, remove, broad, or anon policies.

begin;

do $$
begin
  if to_regclass('public.projects') is null then
    raise exception 'Precondition failed: public.projects does not exist.';
  end if;

  if to_regclass('public.project_members') is null then
    raise exception 'Precondition failed: public.project_members does not exist.';
  end if;

  if to_regprocedure('public.current_employee_id()') is null then
    raise exception 'Precondition failed: public.current_employee_id() does not exist.';
  end if;

  if to_regprocedure('public.has_workspace_access(text)') is null then
    raise exception 'Precondition failed: public.has_workspace_access(text) does not exist.';
  end if;

  if to_regprocedure('public.has_permission(text)') is null then
    raise exception 'Precondition failed: public.has_permission(text) does not exist.';
  end if;
end $$;

create or replace function public.is_project_member(target_project_id bigint)
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
      from public.project_members pm
      where pm.project_id = target_project_id
        and pm.employee_id = public.current_employee_id()
        and pm.status = 'ACTIVE'
    );
$$;

create or replace function public.has_project_role(
  target_project_id bigint,
  target_role_code text
)
returns boolean
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select
    target_role_code in (
      'PROJECT_OWNER',
      'PROJECT_MANAGER',
      'CREATIVE_LEAD',
      'CONTRIBUTOR'
    )
    and public.current_employee_id() is not null
    and exists (
      select 1
      from public.project_members pm
      where pm.project_id = target_project_id
        and pm.employee_id = public.current_employee_id()
        and pm.role_code = target_role_code
        and pm.status = 'ACTIVE'
    );
$$;

create or replace function public.can_view_project(target_project_id bigint)
returns boolean
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select
    (
      public.has_workspace_access('ADMIN_WORKSPACE')
      and public.has_permission('PROJECT_VIEW')
    )
    or public.is_project_member(target_project_id);
$$;

alter function public.is_project_member(bigint) owner to postgres;
alter function public.has_project_role(bigint, text) owner to postgres;
alter function public.can_view_project(bigint) owner to postgres;

revoke all on function public.is_project_member(bigint) from public;
revoke all on function public.is_project_member(bigint) from anon;
revoke all on function public.is_project_member(bigint) from authenticated;
revoke all on function public.has_project_role(bigint, text) from public;
revoke all on function public.has_project_role(bigint, text) from anon;
revoke all on function public.has_project_role(bigint, text) from authenticated;
revoke all on function public.can_view_project(bigint) from public;
revoke all on function public.can_view_project(bigint) from anon;
revoke all on function public.can_view_project(bigint) from authenticated;

grant execute on function public.is_project_member(bigint) to authenticated;
grant execute on function public.has_project_role(bigint, text) to authenticated;
grant execute on function public.can_view_project(bigint) to authenticated;

alter table public.projects enable row level security;

drop policy if exists "projects project access select" on public.projects;
create policy "projects project access select"
on public.projects
for select
to authenticated
using (public.can_view_project(id));

comment on function public.is_project_member(bigint) is
  'Returns true when auth.uid() maps to an ACTIVE employee with ACTIVE membership on the project. Does not trust client employee_id.';

comment on function public.has_project_role(bigint, text) is
  'Returns true when auth.uid() maps to an ACTIVE employee with the requested ACTIVE project role.';

comment on function public.can_view_project(bigint) is
  'Project SELECT authorization: ADMIN_WORKSPACE + PROJECT_VIEW or ACTIVE project membership.';

commit;
