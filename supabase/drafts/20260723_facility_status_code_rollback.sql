-- Facility active-state and stable-code draft rollback package.
-- LIVE_APPROVAL_REQUIRED companion; execute only after reviewed rollback approval.

do $$
begin
  if exists (
    select 1 from public.facilities where is_active is false
  ) then
    raise exception 'Rollback blocked: inactive facility rows exist and dropping is_active would lose operational state.';
  end if;
end $$;

drop index if exists public.facilities_active_idx;
drop index if exists public.facilities_code_unique_idx;

alter table public.facilities
  drop column if exists is_active,
  drop column if exists code;
