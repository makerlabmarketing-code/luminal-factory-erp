-- Rollback for Batch 3D2 system_settings broad-policy remediation.
-- WARNING: this intentionally restores the legacy broad policies and therefore
-- requires a separate approved live rollback/security decision.

begin;

alter table if exists public.system_settings enable row level security;

drop policy if exists "Allow anon all" on public.system_settings;
drop policy if exists "Allow authenticated all" on public.system_settings;

create policy "Allow anon all"
  on public.system_settings
  for all
  to anon
  using (true)
  with check (true);

create policy "Allow authenticated all"
  on public.system_settings
  for all
  to authenticated
  using (true)
  with check (true);

notify pgrst, 'reload schema';

commit;
