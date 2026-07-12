-- Batch 3C2 Owner identity schema migration draft.
-- Draft only. Do not run until approved.
--
-- Purpose:
-- - Add nullable employees.auth_user_id.
-- - Link it to auth.users.id.
-- - Enforce one employee per auth user when auth_user_id is not null.
--
-- Non-goals:
-- - Does not create auth users.
-- - Does not backfill employee records.
-- - Does not change payroll, attendance, RLS, or application code.

alter table public.employees
  add column if not exists auth_user_id uuid null;

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

notify pgrst, 'reload schema';

