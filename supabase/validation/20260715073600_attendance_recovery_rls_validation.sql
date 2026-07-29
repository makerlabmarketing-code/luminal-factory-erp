-- Validation for Attendance Recovery & Shift Calculation Foundation RLS draft.
--
-- Run after the migration is approved and applied. This query does not mutate data.

select
  'attendance row count' as check_name,
  count(*)::text as result
from public.attendance
union all
select
  'attendance_logs row count' as check_name,
  count(*)::text as result
from public.attendance_logs
union all
select
  'shifts row count' as check_name,
  count(*)::text as result
from public.shifts;

select
  schemaname,
  tablename,
  rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('attendance', 'attendance_logs')
order by tablename;

select
  schemaname,
  tablename,
  policyname,
  cmd,
  roles
from pg_policies
where schemaname = 'public'
  and tablename in ('attendance', 'attendance_logs')
  and policyname in (
    'attendance staff own select',
    'attendance staff own insert',
    'attendance staff own update',
    'attendance admin view select',
    'attendance admin manage insert',
    'attendance admin manage update',
    'attendance admin manage delete',
    'attendance logs staff own select',
    'attendance logs staff own insert',
    'attendance logs staff own update',
    'attendance logs admin view select',
    'attendance logs admin manage update'
  )
order by tablename, policyname;

-- A missing helper makes the policy boundary fail closed but also breaks normal
-- Staff check-in/out. Keep this explicit in the post-run evidence.
select object_name, object_exists
from (values
  ('current_employee_id()', to_regprocedure('public.current_employee_id()') is not null),
  ('has_workspace_access(text)', to_regprocedure('public.has_workspace_access(text)') is not null),
  ('has_permission(text)', to_regprocedure('public.has_permission(text)') is not null)
) checks(object_name, object_exists)
order by object_name;

-- PASS requires zero missing policies. This turns the policy inventory above into a
-- checkable result without mutating production data.
with expected(policyname) as (
  values
    ('attendance staff own select'),
    ('attendance staff own insert'),
    ('attendance staff own update'),
    ('attendance admin view select'),
    ('attendance admin manage insert'),
    ('attendance admin manage update'),
    ('attendance admin manage delete'),
    ('attendance logs staff own select'),
    ('attendance logs staff own insert'),
    ('attendance logs staff own update'),
    ('attendance logs admin view select'),
    ('attendance logs admin manage update')
)
select expected.policyname as missing_policy
from expected
left join pg_policies actual
  on actual.schemaname = 'public'
 and actual.tablename in ('attendance', 'attendance_logs')
 and actual.policyname = expected.policyname
where actual.policyname is null
order by expected.policyname;
