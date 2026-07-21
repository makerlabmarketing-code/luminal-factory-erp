begin;
revoke all on function public.create_project_atomic(jsonb) from public, anon, authenticated;
drop function if exists public.create_project_atomic(jsonb);
drop index if exists public.projects_project_code_unique_idx;
alter table public.projects drop constraint if exists projects_project_code_not_blank;
alter table public.projects drop column if exists project_code;
commit;
