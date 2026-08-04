-- Draft rollback. Disable both application gates first. Refuse rollback when audit history is non-empty.
begin;
do $$
begin
  if exists (select 1 from public.attendance_operation_audit) then
    raise exception 'Refusing rollback: attendance operation audit history is non-empty';
  end if;
end $$;
revoke all on function public.admin_attendance_mutation(text,bigint,bigint,date,text,time without time zone,time without time zone,text,uuid) from public, anon, authenticated;
revoke all on function public.staff_attendance_multi_mutation(text) from public, anon, authenticated;
drop function if exists public.admin_attendance_mutation(text,bigint,bigint,date,text,time without time zone,time without time zone,text,uuid);
drop function if exists public.staff_attendance_multi_mutation(text);
drop function if exists public.attendance_audit_state(public.attendance);
drop policy if exists "attendance operation audit admin select" on public.attendance_operation_audit;
drop table if exists public.attendance_operation_audit;
drop index if exists public.attendance_employee_date_shift_active_idx;
commit;
