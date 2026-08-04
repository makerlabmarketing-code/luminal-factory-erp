-- Draft rollback. Disable both application gates first. Refuse rollback when audit history is non-empty.
-- Package contract: attendance_operation_audit; attendance_employee_date_shift_active_idx;
-- public.staff_attendance_multi_mutation(text);
-- public.admin_attendance_mutation(text,bigint,bigint,date,text,time without time zone,time without time zone,text,uuid);
-- policy "attendance operation audit admin select"; cancellation means cancelled_at is non-null.
begin;
do $$
declare
  audit_history_exists boolean := false;
begin
  if to_regclass('public.attendance_operation_audit') is not null then
    execute 'select exists (select 1 from public.attendance_operation_audit)'
      into audit_history_exists;
  end if;
  if audit_history_exists then
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
