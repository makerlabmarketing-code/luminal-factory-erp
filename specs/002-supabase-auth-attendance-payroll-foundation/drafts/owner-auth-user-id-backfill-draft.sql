-- Batch 3C2 Owner auth_user_id backfill draft.
-- Draft only. Do not run until approved.
--
-- Replace <OWNER_AUTH_USER_ID> at execution time from a secure operator channel.
-- Do not commit or print the full auth user id in reports.
--
-- Verified masked evidence before drafting:
-- - employee_internal_id: 3
-- - employee email hash: 02ebdc98273a
-- - auth user id hash: f27b06f2078a
-- - auth user id prefix: a6618a57...

begin;

-- Safety gates: fail if schema is not ready.
do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'employees'
      and column_name = 'auth_user_id'
  ) then
    raise exception 'employees.auth_user_id does not exist';
  end if;
end $$;

-- Safety gates: fail if the target employee or auth user is ambiguous/missing.
do $$
declare
  target_employee_count integer;
  target_auth_count integer;
  target_existing_employee_count integer;
begin
  select count(*)
    into target_employee_count
  from public.employees
  where id = 3
    and substr(md5(lower(trim(email))), 1, 12) = '02ebdc98273a';

  if target_employee_count <> 1 then
    raise exception 'Expected exactly one target employee row, got %', target_employee_count;
  end if;

  select count(*)
    into target_auth_count
  from auth.users
  where id = '<OWNER_AUTH_USER_ID>'::uuid
    and substr(md5(id::text), 1, 12) = 'f27b06f2078a'
    and substr(md5(lower(trim(email))), 1, 12) = '02ebdc98273a';

  if target_auth_count <> 1 then
    raise exception 'Expected exactly one target auth user row, got %', target_auth_count;
  end if;

  select count(*)
    into target_existing_employee_count
  from public.employees
  where auth_user_id = '<OWNER_AUTH_USER_ID>'::uuid
    and id <> 3;

  if target_existing_employee_count <> 0 then
    raise exception 'Auth user is already linked to another employee row';
  end if;
end $$;

update public.employees
set auth_user_id = '<OWNER_AUTH_USER_ID>'::uuid
where id = 3
  and auth_user_id is null
  and substr(md5(lower(trim(email))), 1, 12) = '02ebdc98273a';

-- Confirm exactly one row is linked after update.
do $$
declare
  linked_count integer;
begin
  select count(*)
    into linked_count
  from public.employees
  where id = 3
    and auth_user_id = '<OWNER_AUTH_USER_ID>'::uuid;

  if linked_count <> 1 then
    raise exception 'Owner backfill did not link exactly one employee row';
  end if;
end $$;

commit;

