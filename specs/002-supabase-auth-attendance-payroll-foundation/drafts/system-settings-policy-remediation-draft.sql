-- Batch 3C1-B system_settings policy remediation draft.
-- Draft only. Do not run until dependencies are remediated and approved.
--
-- Preconditions:
-- 1. Direct browser reads/writes of public.system_settings have been removed or
--    replaced with server-mediated routes.
-- 2. SMTP settings have been moved to server-only environment variables or a
--    privileged server-only settings reader with explicit approval.
-- 3. employees.auth_user_id exists and the first Owner/Admin mapping is
--    backfilled, or an approved emergency deny-only rollout is selected.
-- 4. Regression tests for anonymous/authenticated/staff/admin access are ready.

begin;

-- Remove broad public/authenticated access.
drop policy if exists "Allow anon all" on public.system_settings;
drop policy if exists "Allow authenticated all" on public.system_settings;

-- Remove write privileges from browser-facing roles. SELECT is also revoked
-- here because the target state is deny-by-default; public read paths should be
-- explicit server routes or a separate allowlist policy after review.
revoke insert, update, delete, truncate, references, trigger
  on public.system_settings
  from anon, authenticated;

revoke select
  on public.system_settings
  from anon, authenticated;

-- Future identity-aware admin policies. These require employees.auth_user_id.
-- Keep commented until the identity migration has been approved and applied.
--
-- create policy "system settings owner admin read"
--   on public.system_settings
--   for select
--   to authenticated
--   using (
--     exists (
--       select 1
--       from public.employees e
--       where e.auth_user_id = (select auth.uid())
--         and upper(coalesce(e.role, '')) in ('OWNER', 'ADMIN')
--     )
--   );
--
-- create policy "system settings owner admin write"
--   on public.system_settings
--   for all
--   to authenticated
--   using (
--     exists (
--       select 1
--       from public.employees e
--       where e.auth_user_id = (select auth.uid())
--         and upper(coalesce(e.role, '')) in ('OWNER', 'ADMIN')
--     )
--   )
--   with check (
--     exists (
--       select 1
--       from public.employees e
--       where e.auth_user_id = (select auth.uid())
--         and upper(coalesce(e.role, '')) in ('OWNER', 'ADMIN')
--     )
--   );

-- Optional future allowlist for non-sensitive public read settings.
-- Do not add keys here until each key is proven safe for browser exposure.
--
-- create policy "system settings public allowlist read"
--   on public.system_settings
--   for select
--   to anon, authenticated
--   using (
--     key in (
--       -- 'PUBLIC_NON_SECRET_KEY'
--     )
--   );

notify pgrst, 'reload schema';

commit;

