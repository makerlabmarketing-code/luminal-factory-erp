-- Facility active-state and stable-code draft forward package.
-- LIVE_APPROVAL_REQUIRED: do not execute until reviewed and explicitly approved.

alter table public.facilities
  add column if not exists code text,
  add column if not exists is_active boolean not null default true;

comment on column public.facilities.code is 'Stable internal facility code used for employee branch mapping and attendance configuration.';
comment on column public.facilities.is_active is 'Whether this facility is available for new administration and attendance assignment workflows.';

update public.facilities
set code = upper(regexp_replace(coalesce(nullif(trim(facility_name), ''), 'FACILITY-' || id::text), '[^A-Za-z0-9]+', '_', 'g'))
where code is null;

alter table public.facilities
  alter column code set not null;

create unique index if not exists facilities_code_unique_idx
  on public.facilities (code);

create index if not exists facilities_active_idx
  on public.facilities (is_active)
  where is_active = true;
