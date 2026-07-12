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
