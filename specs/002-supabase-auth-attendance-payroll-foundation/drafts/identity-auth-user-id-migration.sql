-- Batch 3B identity migration draft.
-- REVIEW ONLY. Do not run until explicitly approved.
-- This file is intentionally stored under specs/.../drafts, not supabase/migrations.
--
-- Rollout decisions:
-- 1. employees.id remains the internal primary key and relationship key.
-- 2. employees.employee_id remains a business code for display, search, import,
--    export, and internal reconciliation if present. Live verification on
--    2026-07-12 found the column absent, so adding it requires separate approval.
--    It is not the primary FK.
-- 3. full_name is display-only and must not be relationship authority.
-- 4. auth_user_id is nullable because some employees may not have accounts.
-- 5. normalized email uniqueness is conditional and must wait for clean-data
--    verification.
-- 6. This draft does not enable RLS and does not backfill data.

-- ---------------------------------------------------------------------------
-- Step 1: Add nullable auth identity link
-- ---------------------------------------------------------------------------
-- Precondition:
-- - public.employees exists.
-- - auth.users exists.
-- - Read-only validation found no incompatible existing auth_user_id column.
-- - The application still supports employees without auth accounts.
-- - If employees.employee_id is absent, this identity migration does not add it.

begin;

alter table public.employees
  add column if not exists auth_user_id uuid null;

-- Add FK only after validation confirms the column is uuid/null-compatible and
-- no existing non-null values would be orphaned.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'employees_auth_user_id_fkey'
      and conrelid = 'public.employees'::regclass
  ) then
    alter table public.employees
      add constraint employees_auth_user_id_fkey
      foreign key (auth_user_id)
      references auth.users(id)
      on delete set null;
  end if;
end $$;

commit;

-- ---------------------------------------------------------------------------
-- Step 2: Dry-run mapping
-- ---------------------------------------------------------------------------
-- Do not run an update here. Use identity-validation-queries.sql to classify:
-- - certain mappings
-- - manual review
-- - impossible/unmapped

-- ---------------------------------------------------------------------------
-- Step 3: Backfill certain mappings only
-- ---------------------------------------------------------------------------
-- This is deliberately commented out. Run only after reviewing the dry-run
-- output and approving the exact affected employee IDs.

-- begin;
--
-- with employee_email_counts as (
--   select lower(trim(email)) as normalized_email, count(*) as employee_count
--   from public.employees
--   where nullif(trim(email), '') is not null
--   group by lower(trim(email))
-- ),
-- auth_email_counts as (
--   select lower(trim(email)) as normalized_email, count(*) as auth_count
--   from auth.users
--   where nullif(trim(email), '') is not null
--   group by lower(trim(email))
-- ),
-- certain_matches as (
--   select e.id as employee_internal_id, u.id as auth_user_id
--   from public.employees e
--   join auth.users u
--     on lower(trim(u.email)) = lower(trim(e.email))
--   join employee_email_counts ee
--     on ee.normalized_email = lower(trim(e.email))
--   join auth_email_counts ae
--     on ae.normalized_email = lower(trim(e.email))
--   where ee.employee_count = 1
--     and ae.auth_count = 1
--     and e.auth_user_id is null
-- )
-- update public.employees e
-- set auth_user_id = m.auth_user_id
-- from certain_matches m
-- where e.id = m.employee_internal_id;
--
-- commit;

-- ---------------------------------------------------------------------------
-- Step 4: Add uniqueness/indexes after clean-data validation
-- ---------------------------------------------------------------------------
-- Run only after:
-- - no duplicate non-null auth_user_id exists;
-- - no orphan auth_user_id exists;
-- - backfill has been reviewed;
-- - app fallback remains available.

-- create unique index concurrently if not exists employees_auth_user_id_unique_not_null
--   on public.employees (auth_user_id)
--   where auth_user_id is not null;

-- Normalized email unique index is optional and conditional.
-- Run only if duplicate/placeholder/shared email audit is clean.
-- This is not required for canonical identity once auth_user_id exists.

-- create unique index concurrently if not exists employees_normalized_email_unique_not_blank
--   on public.employees ((lower(trim(email))))
--   where email is not null
--     and nullif(trim(email), '') is not null;

-- Non-unique helper index for validation/search can be approved separately if
-- normalized email uniqueness is deferred.

-- create index concurrently if not exists employees_normalized_email_idx
--   on public.employees ((lower(trim(email))))
--   where email is not null
--     and nullif(trim(email), '') is not null;

-- ---------------------------------------------------------------------------
-- Step 5: RLS rollout
-- ---------------------------------------------------------------------------
-- Do not include RLS enablement or policy changes in this identity migration.
-- Use rls-compatibility-policy-draft.sql after identity mapping is verified.
