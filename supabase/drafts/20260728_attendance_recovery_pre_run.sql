-- Read-only pre-run validation for the tracked Attendance recovery RLS migration.
select object_name, object_exists
from (values
  ('attendance', to_regclass('public.attendance') is not null),
  ('attendance_logs', to_regclass('public.attendance_logs') is not null),
  ('employees', to_regclass('public.employees') is not null),
  ('shifts', to_regclass('public.shifts') is not null),
  ('current_employee_id()', to_regprocedure('public.current_employee_id()') is not null),
  ('has_workspace_access(text)', to_regprocedure('public.has_workspace_access(text)') is not null),
  ('has_permission(text)', to_regprocedure('public.has_permission(text)') is not null)
) checks(object_name, object_exists)
order by object_name;

select table_name, row_security_active
from (values
  ('attendance', coalesce((select relrowsecurity from pg_class where oid = 'public.attendance'::regclass), false)),
  ('attendance_logs', coalesce((select relrowsecurity from pg_class where oid = 'public.attendance_logs'::regclass), false))
) checks(table_name, row_security_active);

select tablename, policyname, cmd, roles
from pg_policies
where schemaname = 'public'
  and tablename in ('attendance', 'attendance_logs')
order by tablename, policyname;
