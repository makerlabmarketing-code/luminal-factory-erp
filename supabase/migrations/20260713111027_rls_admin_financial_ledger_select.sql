-- Batch 3C4 RLS slice 1: Admin read access for financial dashboard.
--
-- Threat model:
-- - Browser clients are not trusted to send user IDs, roles, employee IDs, email,
--   or names for authorization.
-- - Business authority is derived only from the Supabase Auth subject:
--   auth.users.id -> employees.auth_user_id -> employees.role/status.
-- - public.is_app_admin() returns only a boolean and exposes no employee data.
-- - SECURITY DEFINER is used only to avoid RLS recursion while checking the
--   employees authorization row from another table policy.
-- - search_path is fixed to avoid object shadowing.
-- - EXECUTE is revoked from PUBLIC/anon and granted only to authenticated.
--
-- Expected function owner: postgres or the Supabase migration owner that owns
-- public.employees. Validate owner before rollout with the validation SQL.

do $$
begin
  if not exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'financial_ledger'
      and c.relkind in ('r', 'p')
      and c.relrowsecurity = true
  ) then
    raise exception 'Precondition failed: public.financial_ledger must exist and have RLS enabled.';
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'financial_ledger'
      and policyname = 'financial ledger admin select'
  ) then
    raise exception 'Precondition failed: policy "financial ledger admin select" already exists.';
  end if;
end $$;

create or replace function public.is_app_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select
    (select auth.uid()) is not null
    and exists (
      select 1
      from public.employees e
      where e.auth_user_id = (select auth.uid())
        and e.status = 'ACTIVE'
        and e.role in ('ADMIN', 'OWNER')
    );
$$;

alter function public.is_app_admin() owner to postgres;

comment on function public.is_app_admin() is
  'Returns true when the current Supabase Auth user maps to an ACTIVE employees row with ADMIN or OWNER role. Uses auth.uid(); accepts no client-provided user ID; exposes no employee data; SECURITY DEFINER avoids RLS recursion for admin policies.';

revoke all on function public.is_app_admin() from public;
revoke all on function public.is_app_admin() from anon;
revoke all on function public.is_app_admin() from authenticated;
grant execute on function public.is_app_admin() to authenticated;

create policy "financial ledger admin select"
on public.financial_ledger
for select
to authenticated
using (public.is_app_admin());
