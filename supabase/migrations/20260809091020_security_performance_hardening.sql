alter function public.attendance_audit_state(public.attendance)
  set search_path = pg_catalog, public;

drop policy if exists "Nhân viên xem hồ sơ của mình" on public.employees;

create policy "Nhân viên xem hồ sơ của mình"
on public.employees
for select
to authenticated
using (auth_user_id = (select auth.uid()));
