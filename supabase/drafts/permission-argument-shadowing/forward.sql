-- LIVE_APPROVAL_REQUIRED: isolated from approved QA-003 package #248.
-- No row, policy, grant, role, workspace, or feature-flag changes.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';
do $guard$
begin
 if not exists(select 1 from pg_proc where oid='public.has_permission(text)'::regprocedure
  and md5(prosrc)='6cbc1b34a0bffe28ba9155688a044af6'
  and proargnames=array['permission_code']::text[] and prosecdef
  and proowner='postgres'::regrole and proconfig=array['search_path=public, auth, pg_temp']) then
  raise exception 'Permission helper changed: review before applying';
 end if;
end $guard$;
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
      where p.code = $1
    )
    and not exists (
      select 1
      from public.employee_permissions ep
      where ep.employee_id = public.current_employee_id()
        and ep.permission_code = $1
        and ep.effect = 'DENY'
        and ep.status = 'ACTIVE'
        and ep.revoked_at is null
    )
    and exists (
      select 1
      from public.employee_permissions ep
      where ep.employee_id = public.current_employee_id()
        and ep.permission_code = $1
        and ep.effect = 'ALLOW'
        and ep.status = 'ACTIVE'
        and ep.revoked_at is null
    );
$$;
commit;
