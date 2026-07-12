# Batch 3C3 Pre-run Review

Date: 2026-07-12

Scope prepared for review only. No migration was applied, no backfill was run,
no migration repair was run, no RLS was changed, no role was changed, no payroll,
attendance, workflow, UI, or application code was changed.

## 1. Migration File Created

`supabase/migrations/20260712181332_add_employee_auth_user_id.sql`

This is the real repository migration file for the schema-only change. It does
not contain the Owner Auth UUID and does not backfill data.

## 2. Schema Migration SQL

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

## 3. Backfill Template

Backfill is intentionally separate from schema migration:

`specs/002-supabase-auth-attendance-payroll-foundation/drafts/3c3-owner-backfill-template.sql`

Properties:

- uses `<OWNER_AUTH_USER_ID>` placeholder only;
- updates only employee internal id `3`;
- requires `auth_user_id is null`;
- requires employee role still `ADMIN`;
- requires employee status still `ACTIVE`;
- requires employee/auth email hash `02ebdc98273a`;
- requires auth id hash `f27b06f2078a`;
- requires confirmed auth email metadata;
- refuses if the Auth user is already linked to any employee;
- does not change role, email, or any other employee record.

## 4. Validation Query

Validation artifact:

`specs/002-supabase-auth-attendance-payroll-foundation/drafts/3c3-owner-validation.sql`

Checks:

- `employees.auth_user_id` column exists;
- FK exists;
- partial unique index exists;
- employee id `3` maps to exactly one matching Auth user;
- no duplicate `auth_user_id`;
- no orphan `auth_user_id`;
- role remains `ADMIN`;
- employee remains `ACTIVE`.

The query masks full email and full Auth user ID.

## 5. Rollback SQL

Rollback artifact:

`specs/002-supabase-auth-attendance-payroll-foundation/drafts/3c3-owner-rollback.sql`

Rollback order:

1. remove Owner mapping for employee id `3`;
2. drop `employees_auth_user_id_unique_not_null`;
3. drop `employees_auth_user_id_fkey`;
4. drop `employees.auth_user_id`.

Rollback does not delete the Auth user, does not delete the employee, and refuses
schema rollback if other `auth_user_id` mappings exist.

## 6. Commands Planned After Approval

Apply schema migration after SQL approval:

```bash
npx supabase migration up --linked
```

Then run manual backfill in Supabase SQL Editor using the approved
`3c3-owner-backfill-template.sql` with `<OWNER_AUTH_USER_ID>` substituted from a
secure operator channel.

Then run validation:

```bash
npx supabase db query --linked --file specs/002-supabase-auth-attendance-payroll-foundation/drafts/3c3-owner-validation.sql
```

Rollback, only if approved:

```bash
npx supabase db query --linked --file specs/002-supabase-auth-attendance-payroll-foundation/drafts/3c3-owner-rollback.sql
```

## 7. Pre-run Confirmation

- No real Auth UUID is committed in tracked files.
- No full owner email is committed in the new Batch 3C3 files.
- No Owner role change is included.
- No payroll, attendance, workflow, UI, or application code is touched.
- Schema migration and Owner backfill are separate.
- Normalized email unique index is not included.
- `employees.id` remains the internal relationship key.
- `full_name` is not used as relationship authority.
