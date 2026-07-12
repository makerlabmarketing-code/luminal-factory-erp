-- Batch 3C3 rollback draft.
-- Manual execution template. Do not run unless approved.
--
-- Rollback order:
-- 1. Remove Owner mapping for employee id 3.
-- 2. Drop unique partial index.
-- 3. Drop FK.
-- 4. Drop auth_user_id column.
--
-- SECURITY:
-- - Replace <OWNER_AUTH_USER_ID> at execution time only.
-- - Do not commit or report the full UUID.
-- - This does not delete the Auth user.
-- - This does not delete or otherwise change the employee record.

begin;

do $$
declare
  target_mapping_count integer;
  other_mapping_count integer;
begin
  select count(*)
    into target_mapping_count
  from public.employees
  where id = 3
    and auth_user_id = '<OWNER_AUTH_USER_ID>'::uuid
    and role = 'ADMIN'
    and status = 'ACTIVE'
    and substr(md5(lower(trim(email))), 1, 12) = '02ebdc98273a';

  if target_mapping_count <> 1 then
    raise exception 'Expected exactly one Owner mapping to rollback, got %', target_mapping_count;
  end if;

  select count(*)
    into other_mapping_count
  from public.employees
  where auth_user_id is not null
    and id <> 3;

  if other_mapping_count <> 0 then
    raise exception 'Refusing schema rollback because other auth_user_id mappings exist: %', other_mapping_count;
  end if;
end $$;

update public.employees
set auth_user_id = null
where id = 3
  and auth_user_id = '<OWNER_AUTH_USER_ID>'::uuid
  and role = 'ADMIN'
  and status = 'ACTIVE'
  and substr(md5(lower(trim(email))), 1, 12) = '02ebdc98273a';

drop index if exists public.employees_auth_user_id_unique_not_null;

alter table public.employees
  drop constraint if exists employees_auth_user_id_fkey;

alter table public.employees
  drop column if exists auth_user_id;

commit;
