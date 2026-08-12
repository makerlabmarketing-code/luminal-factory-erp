-- Disable PROJECT_MEMBERSHIP_ATOMIC_MUTATIONS_ENABLED before this rollback.
-- WARNING: dropping project_membership_audit permanently removes its immutable
-- history. Export and retain the audit table before an approved rollback.

begin;

drop function if exists public.mutate_project_membership(text, bigint, bigint, bigint, text, bigint, text, uuid);
drop trigger if exists project_membership_audit_immutable on public.project_membership_audit;
drop function if exists public.reject_project_membership_audit_mutation();
drop table if exists public.project_membership_audit;

drop index if exists public.project_members_one_active_employee;
create unique index if not exists project_members_one_active_role
  on public.project_members(project_id, employee_id, role_code)
  where status = 'ACTIVE';

grant insert, update on public.project_members to authenticated;
grant usage on sequence public.project_members_id_seq to authenticated;

commit;
