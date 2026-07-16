-- Rollback for Project Read RLS rollout.
--
-- Scope:
-- - Drop only Project Read RLS policy created by this rollout.
-- - Drop only Project Read RLS helper functions created by this rollout.
-- - Restore the pre-run broad projects grants observed during audit.
--
-- This rollback intentionally does not:
-- - Modify data.
-- - Modify project_members rows.
-- - Modify phases, tasks, staff_tasks, employees, attendance, or finance.

begin;

drop policy if exists "projects project access select" on public.projects;

revoke all on function public.can_view_project(bigint) from public;
revoke all on function public.can_view_project(bigint) from anon;
revoke all on function public.can_view_project(bigint) from authenticated;
revoke all on function public.has_project_role(bigint, text) from public;
revoke all on function public.has_project_role(bigint, text) from anon;
revoke all on function public.has_project_role(bigint, text) from authenticated;
revoke all on function public.is_project_member(bigint) from public;
revoke all on function public.is_project_member(bigint) from anon;
revoke all on function public.is_project_member(bigint) from authenticated;

drop function if exists public.can_view_project(bigint);
drop function if exists public.has_project_role(bigint, text);
drop function if exists public.is_project_member(bigint);

commit;
