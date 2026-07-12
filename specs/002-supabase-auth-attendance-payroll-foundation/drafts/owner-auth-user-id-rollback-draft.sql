-- Batch 3C2 Owner identity rollback draft.
-- Draft only. Do not run until approved.
--
-- This rolls back only the Owner backfill for employee_internal_id 3.
-- It does not drop employees.auth_user_id, the FK, or the unique index because
-- later batches may add more mappings.
--
-- Replace <OWNER_AUTH_USER_ID> at execution time from a secure operator channel.
-- Do not commit or print the full auth user id in reports.

begin;

do $$
declare
  target_count integer;
begin
  select count(*)
    into target_count
  from public.employees
  where id = 3
    and auth_user_id = '<OWNER_AUTH_USER_ID>'::uuid
    and substr(md5(lower(trim(email))), 1, 12) = '02ebdc98273a';

  if target_count <> 1 then
    raise exception 'Expected exactly one Owner mapping to rollback, got %', target_count;
  end if;
end $$;

update public.employees
set auth_user_id = null
where id = 3
  and auth_user_id = '<OWNER_AUTH_USER_ID>'::uuid
  and substr(md5(lower(trim(email))), 1, 12) = '02ebdc98273a';

commit;

-- Optional schema rollback for an abandoned identity migration only.
-- Do not run after any other employee mappings have been added.
--
-- drop index if exists public.employees_auth_user_id_unique_not_null;
-- alter table public.employees
--   drop constraint if exists employees_auth_user_id_fkey;
-- alter table public.employees
--   drop column if exists auth_user_id;

