-- Batch 3C3 Owner mapping backfill template.
-- Manual execution template for Supabase SQL Editor after schema migration is applied.
--
-- SECURITY:
-- - Replace <OWNER_AUTH_USER_ID> at execution time only.
-- - Do not commit the real UUID to Git.
-- - Do not put OWNER_AUTH_USER_ID in any NEXT_PUBLIC_* variable.
-- - Do not log or report the full UUID.
--
-- Verified masked evidence from Batch 3C2:
-- - target employee internal id: 3
-- - target employee/auth email hash: 02ebdc98273a
-- - target auth user id hash: f27b06f2078a
-- - target auth user id prefix: a6618a57...
-- - employee role remains ADMIN in Batch 3C3

begin;

do $$
declare
  target_employee_count integer;
  target_auth_count integer;
  existing_auth_link_count integer;
  updated_count integer;
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'employees'
      and column_name = 'auth_user_id'
  ) then
    raise exception 'employees.auth_user_id does not exist. Apply schema migration first.';
  end if;

  select count(*)
    into target_employee_count
  from public.employees
  where id = 3
    and auth_user_id is null
    and status = 'ACTIVE'
    and role = 'ADMIN'
    and substr(md5(lower(trim(email))), 1, 12) = '02ebdc98273a';

  if target_employee_count <> 1 then
    raise exception 'Expected exactly one active ADMIN employee id 3 with null auth_user_id and matching email hash, got %', target_employee_count;
  end if;

  select count(*)
    into target_auth_count
  from auth.users
  where id = '<OWNER_AUTH_USER_ID>'::uuid
    and substr(md5(id::text), 1, 12) = 'f27b06f2078a'
    and substr(md5(lower(trim(email))), 1, 12) = '02ebdc98273a'
    and email_confirmed_at is not null;

  if target_auth_count <> 1 then
    raise exception 'Expected exactly one confirmed target auth user with matching id/email hash, got %', target_auth_count;
  end if;

  select count(*)
    into existing_auth_link_count
  from public.employees
  where auth_user_id = '<OWNER_AUTH_USER_ID>'::uuid;

  if existing_auth_link_count <> 0 then
    raise exception 'Target auth user is already linked to an employee record';
  end if;

  update public.employees
  set auth_user_id = '<OWNER_AUTH_USER_ID>'::uuid
  where id = 3
    and auth_user_id is null
    and role = 'ADMIN'
    and status = 'ACTIVE'
    and substr(md5(lower(trim(email))), 1, 12) = '02ebdc98273a';

  get diagnostics updated_count = row_count;

  if updated_count <> 1 then
    raise exception 'Owner backfill updated % rows; expected exactly 1', updated_count;
  end if;
end $$;

commit;

