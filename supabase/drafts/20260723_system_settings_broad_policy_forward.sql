-- Batch 3D2: system_settings broad-policy remediation.
-- Reviewed package only; production delivery must use the Supabase GitHub Integration
-- after approval. Do not execute directly from Codex Cloud.

begin;

alter table if exists public.system_settings enable row level security;

drop policy if exists "Allow anon all" on public.system_settings;
drop policy if exists "Allow authenticated all" on public.system_settings;

notify pgrst, 'reload schema';

commit;
