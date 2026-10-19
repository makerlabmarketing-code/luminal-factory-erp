-- Disable PHASE_MEMBERS_ENABLED and revert application first.
-- Never silently discard live assignments or audit history.
begin;
do $$ begin
  if exists(select 1 from public.project_phase_members) or exists(select 1 from public.project_phase_member_audit) then
    raise exception 'phase_members_export_required: preserve assignments and history before schema removal';
  end if;
end $$;
drop function public.set_project_phase_members_atomic(bigint,bigint,bigint[],bigint[],bigint);
drop table public.project_phase_member_audit;
drop table public.project_phase_members;
drop function public.block_phase_member_audit_change();
commit;
