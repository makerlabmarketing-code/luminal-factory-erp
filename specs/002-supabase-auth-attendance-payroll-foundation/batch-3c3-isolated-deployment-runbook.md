# Batch 3C3 Isolated Deployment Runbook

Date: 2026-07-12

Purpose: apply only `20260712181332_add_employee_auth_user_id` while migration
history is drifted. Do not run `supabase migration up --linked`,
`supabase db push`, or migration repair for old local-only migrations.

Do not commit or print the real Owner Auth UUID. Replace
`<OWNER_AUTH_USER_ID>` only inside Supabase SQL Editor or another approved secure
operator channel.

## PASS/FAIL Summary

PASS only when all of these are true:

1. Preflight checks pass.
2. Schema migration SQL runs successfully in Supabase SQL Editor.
3. Schema validation returns expected values.
4. Owner backfill template updates exactly one row.
5. Mapping validation returns no duplicates, no orphans, employee `3` is still
   `ACTIVE`, and role is still `ADMIN`.
6. Migration equivalence evidence is saved before any migration-history repair.

FAIL and stop when any check returns unexpected counts, missing objects,
mismatched hashes, or any transaction raises an exception.

## Part 1. Before Running

Run this read-only preflight SQL in Supabase SQL Editor or another approved
read-only query channel.

This parse-safe preflight intentionally does not require the full Owner Auth
UUID. It verifies the target Auth user using only the saved masked evidence:

- Auth user ID hash: `f27b06f2078a`
- normalized email hash: `02ebdc98273a`

It also intentionally avoids referencing `public.employees.auth_user_id` until
after confirming whether that column exists. If the column does not exist, the
employee mapping condition is `not_applicable_pre_migration`.

Expected:

- `employees_table_exists = true`
- `auth_user_id_exists = false`
- `fk_name_exists = false`
- `index_name_exists = false`
- `target_auth_user_count = 1`
- `target_employee_count = 1`
- `target_employee_mapping_check = not_applicable_pre_migration`
- `target_employee_role = ADMIN`
- `target_employee_status = ACTIVE`
- `target_employee_email_hash = 02ebdc98273a`

```sql
select jsonb_build_object(
  'employees_table_exists',
    to_regclass('public.employees') is not null,
  'auth_user_id_exists',
    exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'employees'
        and column_name = 'auth_user_id'
    ),
  'fk_name_exists',
    exists (
      select 1
      from pg_constraint
      where conrelid = to_regclass('public.employees')
        and conname = 'employees_auth_user_id_fkey'
    ),
  'index_name_exists',
    exists (
      select 1
      from pg_indexes
      where schemaname = 'public'
        and tablename = 'employees'
        and indexname = 'employees_auth_user_id_unique_not_null'
    ),
  'auth_users_id_type',
    (
      select data_type
      from information_schema.columns
      where table_schema = 'auth'
        and table_name = 'users'
        and column_name = 'id'
    ),
  'auth_users_id_udt_name',
    (
      select udt_name
      from information_schema.columns
      where table_schema = 'auth'
        and table_name = 'users'
        and column_name = 'id'
    ),
  'target_auth_user_count',
    (
      select count(*)
      from auth.users
      where substr(md5(id::text), 1, 12) = 'f27b06f2078a'
        and substr(md5(lower(trim(email))), 1, 12) = '02ebdc98273a'
        and email_confirmed_at is not null
    ),
  'target_employee_count',
    (
      select count(*)
      from public.employees
      where id = 3
        and role = 'ADMIN'
        and status = 'ACTIVE'
        and substr(md5(lower(trim(email))), 1, 12) = '02ebdc98273a'
    ),
  'target_employee_role',
    (
      select role
      from public.employees
      where id = 3
    ),
  'target_employee_status',
    (
      select status
      from public.employees
      where id = 3
    ),
  'target_employee_email_hash',
    (
      select substr(md5(lower(trim(email))), 1, 12)
      from public.employees
      where id = 3
    ),
  'target_employee_mapping_check',
    case
      when exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'employees'
          and column_name = 'auth_user_id'
      ) then 'schema_drift_mapping_check_required'
      else 'not_applicable_pre_migration'
    end
) as batch_3c3_preflight_parse_safe;
```

Recovery if this fails:

- Do not run schema migration.
- If `auth_user_id_exists = true`, this is schema drift for Batch 3C3. Do not
  run schema migration. Run only the drift inspection query below, then stop.
- If target auth count is not `1`, re-check the invite/user in Supabase Auth.
- If target employee count is not `1`, stop and review the employee record.
- If employee role/status changed, stop and decide whether Batch 3C3 assumptions
  still hold.

If and only if `auth_user_id_exists = true`, run this read-only drift inspection
query. It references `auth_user_id`, so do not run it before the first preflight
confirms the column exists.

Expected for the normal Batch 3C3 path: this query is not applicable because
`auth_user_id_exists = false`.

```sql
select jsonb_build_object(
  'schema_drift', true,
  'owner_mapping',
    (
      select coalesce(jsonb_agg(jsonb_build_object(
        'employee_internal_id', e.id,
        'role', e.role,
        'status', e.status,
        'is_active', e.is_active,
        'employee_email_hash', substr(md5(lower(trim(e.email))), 1, 12),
        'auth_user_id_hash', case
          when e.auth_user_id is null then null
          else substr(md5(e.auth_user_id::text), 1, 12)
        end,
        'matching_auth_user_count',
          (
            select count(*)
            from auth.users u
            where u.id = e.auth_user_id
              and substr(md5(lower(trim(u.email))), 1, 12) = substr(md5(lower(trim(e.email))), 1, 12)
          )
      ) order by e.id), '[]'::jsonb)
      from public.employees e
      where e.id = 3
    ),
  'non_null_auth_user_id_count',
    (
      select count(*)
      from public.employees
      where auth_user_id is not null
    ),
  'duplicate_auth_user_id_links',
    (
      select coalesce(jsonb_agg(jsonb_build_object(
        'auth_user_id_hash', substr(md5(auth_user_id::text), 1, 12),
        'employee_count', employee_count,
        'employee_internal_ids', employee_internal_ids
      )), '[]'::jsonb)
      from (
        select
          auth_user_id,
          count(*) as employee_count,
          jsonb_agg(id order by id) as employee_internal_ids
        from public.employees
        where auth_user_id is not null
        group by auth_user_id
        having count(*) > 1
      ) duplicates
    ),
  'orphan_auth_user_id_links',
    (
      select coalesce(jsonb_agg(jsonb_build_object(
        'employee_internal_id', e.id,
        'auth_user_id_hash', substr(md5(e.auth_user_id::text), 1, 12)
      ) order by e.id), '[]'::jsonb)
      from public.employees e
      left join auth.users u on u.id = e.auth_user_id
      where e.auth_user_id is not null
        and u.id is null
    )
) as batch_3c3_preflight_schema_drift_inspection;
```

## Part 2. Schema Migration

Copy only this SQL into Supabase SQL Editor. It has no backfill, no real Auth
UUID, no role change, no email change, no record update, no RLS change, and no
normalized email index.

```sql
-- Link Luminal employee records to Supabase Auth identities.
-- employees.id remains the internal relationship key.
-- employees.auth_user_id is nullable for employees without Auth accounts.

alter table public.employees
  add column if not exists auth_user_id uuid null;

comment on column public.employees.auth_user_id is
  'Nullable link to auth.users.id for authenticated ERP identity mapping. employees.id remains the internal employee relationship key.';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.employees'::regclass
      and conname = 'employees_auth_user_id_fkey'
  ) then
    alter table public.employees
      add constraint employees_auth_user_id_fkey
      foreign key (auth_user_id)
      references auth.users(id)
      on delete set null;
  end if;
end $$;

create unique index if not exists employees_auth_user_id_unique_not_null
  on public.employees (auth_user_id)
  where auth_user_id is not null;
```

Recovery if this fails:

- Do not run backfill.
- Copy the SQL Editor error exactly without secrets.
- If failure is a name collision, inspect the existing object before deciding
  whether it is equivalent.
- If failure is a lock/timeout, retry only after confirming no partial object was
  created.

## Part 3. Schema Validation

Run this after Part 2.

Expected:

- column exists;
- type is `uuid`;
- nullable is `YES`;
- FK points to `auth.users(id)`;
- FK delete rule is `SET NULL`;
- partial unique index exists;
- no employees have non-null `auth_user_id` yet.

```sql
select jsonb_build_object(
  'auth_user_id_column',
    (
      select jsonb_build_object(
        'exists', count(*) = 1,
        'data_type', max(data_type),
        'is_nullable', max(is_nullable)
      )
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'employees'
        and column_name = 'auth_user_id'
    ),
  'foreign_key',
    (
      select coalesce(jsonb_agg(jsonb_build_object(
        'constraint_name', c.conname,
        'source_table', c.conrelid::regclass::text,
        'source_column', source_attr.attname,
        'target_table', c.confrelid::regclass::text,
        'target_column', target_attr.attname,
        'delete_rule', case c.confdeltype
          when 'a' then 'NO ACTION'
          when 'r' then 'RESTRICT'
          when 'c' then 'CASCADE'
          when 'n' then 'SET NULL'
          when 'd' then 'SET DEFAULT'
          else c.confdeltype::text
        end,
        'constraint_def', pg_get_constraintdef(c.oid, true)
      ) order by c.conname), '[]'::jsonb)
      from pg_constraint c
      join unnest(c.conkey) with ordinality as source_key(attnum, ord)
        on true
      join unnest(c.confkey) with ordinality as target_key(attnum, ord)
        on target_key.ord = source_key.ord
      join pg_attribute source_attr
        on source_attr.attrelid = c.conrelid
       and source_attr.attnum = source_key.attnum
      join pg_attribute target_attr
        on target_attr.attrelid = c.confrelid
       and target_attr.attnum = target_key.attnum
      where c.conrelid = to_regclass('public.employees')
        and c.conname = 'employees_auth_user_id_fkey'
        and c.contype = 'f'
    ),
  'unique_partial_index',
    (
      select coalesce(jsonb_agg(jsonb_build_object(
        'indexname', indexname,
        'indexdef', indexdef
      )), '[]'::jsonb)
      from pg_indexes
      where schemaname = 'public'
        and tablename = 'employees'
        and indexname = 'employees_auth_user_id_unique_not_null'
    ),
  'non_null_auth_user_id_count',
    (
      select count(*)
      from public.employees
      where auth_user_id is not null
    )
) as batch_3c3_schema_validation;
```

Recovery if this fails:

- If column/FK/index is missing, do not backfill.
- If `non_null_auth_user_id_count` is not `0`, stop and inspect who wrote
  mappings before this run.
- If FK delete rule is not `SET NULL`, rollback schema before continuing.

## Part 4. Owner Backfill

Use the existing template:

`specs/002-supabase-auth-attendance-payroll-foundation/drafts/3c3-owner-backfill-template.sql`

Replace `<OWNER_AUTH_USER_ID>` only inside Supabase SQL Editor. Do not save the
real UUID into a tracked file.

The template:

- updates only employee id `3`;
- requires `auth_user_id is null`;
- checks target Auth user exists;
- checks auth ID hash and normalized email hash;
- refuses if the Auth user is already linked;
- fails transaction if `updated_count <> 1`;
- does not change role, email, or any other record.

SQL template:

```sql
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
```

Recovery if this fails:

- Transaction should abort automatically.
- Do not rerun with edited guards.
- Re-run Part 5 validation to see whether any mapping was written.
- If no mapping was written, fix the failed precondition and rerun only after
  review.

## Part 5. Mapping Validation

Run after Part 4.

Expected:

- employee id `3` has one non-null `auth_user_id`;
- linked Auth user exists;
- normalized email hashes match;
- no duplicate `auth_user_id`;
- no orphan `auth_user_id`;
- employee status remains `ACTIVE`;
- employee role remains `ADMIN`.

```sql
select jsonb_build_object(
  'owner_mapping',
    (
      select coalesce(jsonb_agg(jsonb_build_object(
        'employee_internal_id', e.id,
        'role', e.role,
        'status', e.status,
        'is_active', e.is_active,
        'employee_email_hash', substr(md5(lower(trim(e.email))), 1, 12),
        'auth_user_id_prefix', case
          when e.auth_user_id is null then null
          else substr(e.auth_user_id::text, 1, 8) || '...'
        end,
        'auth_user_id_hash', case
          when e.auth_user_id is null then null
          else substr(md5(e.auth_user_id::text), 1, 12)
        end,
        'matching_auth_user_count',
          (
            select count(*)
            from auth.users u
            where u.id = e.auth_user_id
              and substr(md5(lower(trim(u.email))), 1, 12) = substr(md5(lower(trim(e.email))), 1, 12)
          )
      ) order by e.id), '[]'::jsonb)
      from public.employees e
      where e.id = 3
    ),
  'owner_non_null_mapping_count',
    (
      select count(*)
      from public.employees
      where id = 3
        and auth_user_id is not null
        and role = 'ADMIN'
        and status = 'ACTIVE'
    ),
  'duplicate_auth_user_id_links',
    (
      select coalesce(jsonb_agg(jsonb_build_object(
        'auth_user_id_prefix', substr(auth_user_id::text, 1, 8) || '...',
        'auth_user_id_hash', substr(md5(auth_user_id::text), 1, 12),
        'employee_count', employee_count,
        'employee_internal_ids', employee_internal_ids
      )), '[]'::jsonb)
      from (
        select
          auth_user_id,
          count(*) as employee_count,
          jsonb_agg(id order by id) as employee_internal_ids
        from public.employees
        where auth_user_id is not null
        group by auth_user_id
        having count(*) > 1
      ) duplicates
    ),
  'orphan_auth_user_id_links',
    (
      select coalesce(jsonb_agg(jsonb_build_object(
        'employee_internal_id', e.id,
        'auth_user_id_prefix', substr(e.auth_user_id::text, 1, 8) || '...',
        'auth_user_id_hash', substr(md5(e.auth_user_id::text), 1, 12)
      ) order by e.id), '[]'::jsonb)
      from public.employees e
      left join auth.users u on u.id = e.auth_user_id
      where e.auth_user_id is not null
        and u.id is null
    )
) as batch_3c3_mapping_validation;
```

PASS criteria:

- `owner_non_null_mapping_count = 1`
- `owner_mapping[0].matching_auth_user_count = 1`
- `owner_mapping[0].role = ADMIN`
- `owner_mapping[0].status = ACTIVE`
- `duplicate_auth_user_id_links = []`
- `orphan_auth_user_id_links = []`

Recovery if this fails:

- If owner mapping count is `0`, do not repair migration history; rerun backfill
  only after identifying failed guard.
- If duplicate/orphan mappings exist, do not continue; run rollback only after
  approval.
- If role/status changed, stop because out-of-scope data changed.

## Part 6. Migration History

Only after Parts 3 and 5 PASS, save equivalence evidence:

- SQL migration file path and version: `20260712181332`.
- Schema validation output.
- Mapping validation output.
- Confirmation that no old migrations were run.
- Confirmation that Owner backfill was separate from schema migration.

Then propose this command only:

```bash
npx supabase migration repair --linked --status applied 20260712181332
```

Do not run it in this runbook. Do not repair or mark these old local-only
migrations as applied:

- `20260704153000`
- `20260709110000`

Recovery if repair later fails:

- Do not use `migration up --linked`.
- Keep the saved equivalence evidence.
- Re-run `npx supabase migration list` and decide the next history-only action.

## Part 7. Rollback

Rollback A: Owner mapping only.

Use this if the schema is correct but Owner mapping must be undone.

```sql
begin;

do $$
declare
  target_mapping_count integer;
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
end $$;

update public.employees
set auth_user_id = null
where id = 3
  and auth_user_id = '<OWNER_AUTH_USER_ID>'::uuid
  and role = 'ADMIN'
  and status = 'ACTIVE'
  and substr(md5(lower(trim(email))), 1, 12) = '02ebdc98273a';

commit;
```

Rollback B: schema migration.

Run only after Rollback A and only when no other `auth_user_id` mappings exist.
This does not delete the Auth user and does not delete the employee.

```sql
begin;

do $$
declare
  remaining_mapping_count integer;
begin
  select count(*)
    into remaining_mapping_count
  from public.employees
  where auth_user_id is not null;

  if remaining_mapping_count <> 0 then
    raise exception 'Refusing schema rollback because auth_user_id mappings remain: %', remaining_mapping_count;
  end if;
end $$;

drop index if exists public.employees_auth_user_id_unique_not_null;

alter table public.employees
  drop constraint if exists employees_auth_user_id_fkey;

alter table public.employees
  drop column if exists auth_user_id;

commit;
```

Recovery if rollback fails:

- Do not delete the Auth user.
- Do not delete employee id `3`.
- Inspect whether any other mapping exists.
- If schema rollback is blocked by remaining mappings, keep schema and only fix
  the incorrect mapping after approval.
