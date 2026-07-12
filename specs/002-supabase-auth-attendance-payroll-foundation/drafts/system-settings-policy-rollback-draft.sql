-- Batch 3C1-B system_settings rollback draft.
-- Draft only. Do not run unless an approved remediation rollout must be
-- reverted. This restores the current broad access and is intentionally unsafe
-- except as a short emergency rollback.

begin;

drop policy if exists "system settings owner admin read" on public.system_settings;
drop policy if exists "system settings owner admin write" on public.system_settings;
drop policy if exists "system settings public allowlist read" on public.system_settings;

grant select, insert, update, delete
  on public.system_settings
  to anon, authenticated;

drop policy if exists "Allow anon all" on public.system_settings;
create policy "Allow anon all"
  on public.system_settings
  for all
  to anon
  using (true)
  with check (true);

drop policy if exists "Allow authenticated all" on public.system_settings;
create policy "Allow authenticated all"
  on public.system_settings
  for all
  to authenticated
  using (true)
  with check (true);

notify pgrst, 'reload schema';

commit;

