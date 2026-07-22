-- Corrective Slice 5 permission catalog expansion rollback draft.
-- LIVE_APPROVAL_REQUIRED: do not execute without explicit live approval.
-- Rollback is safe only before any employee_permissions rows reference these keys.

begin;

do $$
begin
  if exists (
    select 1
    from public.employee_permissions
    where permission_code in ('TASK_VIEW', 'TASK_MANAGE', 'TASK_ASSIGN', 'TASK_REVIEW')
      and status = 'ACTIVE'
  ) then
    raise exception 'Rollback blocked: active employee permission rows reference task permission keys.';
  end if;
end $$;

delete from public.permissions
where code in ('TASK_VIEW', 'TASK_MANAGE', 'TASK_ASSIGN', 'TASK_REVIEW');

commit;
