-- Rollback for Batch 3E1 own-row RLS package.
-- Requires separate approved live rollback/security decision.
-- This removes only the employees own-profile policy introduced by the package.
-- It intentionally does not disable RLS or drop existing admin/attendance policies.

begin;

drop policy if exists "employees staff own profile select" on public.employees;

commit;
