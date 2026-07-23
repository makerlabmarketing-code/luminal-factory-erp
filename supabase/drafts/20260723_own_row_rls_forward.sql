-- Batch 3E1: own-row RLS package for employees, attendance, and attendance_logs.
-- Draft only. Do not execute or promote to supabase/migrations without live approval.
-- Scope:
-- - Enable RLS on public.employees, public.attendance, and public.attendance_logs.
-- - Add the missing employees own-row SELECT policy through auth.uid() -> employees.auth_user_id.
-- - Preserve existing admin employee-view and attendance recovery policies.
-- - Do not change payroll, finance, Auth users, role rows, attendance calculations, or data.

begin;

do $$
begin
  if to_regclass('public.employees') is null then
    raise exception 'Precondition failed: public.employees does not exist.';
  end if;

  if to_regclass('public.attendance') is null then
    raise exception 'Precondition failed: public.attendance does not exist.';
  end if;

  if to_regclass('public.attendance_logs') is null then
    raise exception 'Precondition failed: public.attendance_logs does not exist.';
  end if;

  if to_regprocedure('public.current_employee_id()') is null then
    raise exception 'Precondition failed: public.current_employee_id() does not exist.';
  end if;

  if to_regprocedure('public.has_workspace_access(text)') is null then
    raise exception 'Precondition failed: public.has_workspace_access(text) does not exist.';
  end if;

  if to_regprocedure('public.has_permission(text)') is null then
    raise exception 'Precondition failed: public.has_permission(text) does not exist.';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'employees'
      and column_name = 'auth_user_id'
      and data_type = 'uuid'
  ) then
    raise exception 'Precondition failed: public.employees.auth_user_id uuid does not exist.';
  end if;
end $$;

alter table public.employees enable row level security;
alter table public.attendance enable row level security;
alter table public.attendance_logs enable row level security;

grant select on public.employees to authenticated;

drop policy if exists "employees staff own profile select" on public.employees;
create policy "employees staff own profile select"
on public.employees
for select
to authenticated
using (
  auth_user_id = (select auth.uid())
  and public.has_workspace_access('STAFF_WORKSPACE')
);

comment on policy "employees staff own profile select" on public.employees is
  'Staff Workspace users can read only their own employee profile through employees.auth_user_id = auth.uid().';

commit;
