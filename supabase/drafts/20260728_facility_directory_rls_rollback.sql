-- Roll back only the narrowly scoped Facility Directory read policy and grant.
begin;

drop policy if exists "facilities authorized directory select" on public.facilities;
revoke select on public.facilities from authenticated;

-- RLS is intentionally not disabled: another policy may depend on it.
-- Existing policies, rows, code/is_active columns, and employee branch_code values are untouched.
commit;
