-- Batch 3B rollback draft.
-- REVIEW ONLY. Do not run until explicitly approved.
-- Roll back in the reverse order of the approved rollout step.

-- ---------------------------------------------------------------------------
-- Rollback Step 4 indexes
-- ---------------------------------------------------------------------------

-- drop index concurrently if exists public.employees_normalized_email_unique_not_blank;
-- drop index concurrently if exists public.employees_normalized_email_idx;
-- drop index concurrently if exists public.employees_auth_user_id_unique_not_null;

-- ---------------------------------------------------------------------------
-- Rollback Step 3 backfill
-- ---------------------------------------------------------------------------
-- Only run if the application has been reverted to the previous email-based
-- compatibility mapping and the affected employee IDs are approved.

-- begin;
-- update public.employees
-- set auth_user_id = null
-- where id = any (:approved_employee_internal_ids);
-- commit;

-- ---------------------------------------------------------------------------
-- Rollback Step 1 identity link
-- ---------------------------------------------------------------------------
-- Destructive to auth mapping. Run only after app rollback is complete.

-- begin;
-- alter table public.employees
--   drop constraint if exists employees_auth_user_id_fkey;
-- alter table public.employees
--   drop column if exists auth_user_id;
-- commit;

-- ---------------------------------------------------------------------------
-- Rollback RLS compatibility policies
-- ---------------------------------------------------------------------------
-- Policy names are draft placeholders. Use live policy names from pg_policy
-- verification before running any rollback.

-- drop policy if exists "employees_select_self_or_admin_compat" on public.employees;
-- drop policy if exists "attendance_select_self_or_admin_compat" on public.attendance;
-- drop policy if exists "attendance_logs_select_self_or_admin_compat" on public.attendance_logs;
-- drop policy if exists "tasks_select_assigned_or_admin_compat" on public.tasks;
-- drop function if exists public.current_employee_id();
-- drop function if exists public.current_employee_role();
-- drop function if exists public.is_role_compat(text[]);
