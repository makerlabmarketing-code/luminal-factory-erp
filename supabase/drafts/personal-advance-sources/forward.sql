-- Pending approval. Register payment sources without assigning ownership percentages.
begin;
lock table public.shareholders in share row exclusive mode;

do $$
declare
  expected_names constant text[] := array['Nguyễn Sơn Hà', 'Đào Tùng Duy'];
  contributor text;
  matching_rows integer;
  active_rows integer;
begin
  foreach contributor in array expected_names loop
    if not exists (
      select 1
      from public.finance_monthly_capital_rates r
      join public.employees e on e.id = r.employee_id
      where btrim(e.full_name) = contributor
    ) then
      raise exception 'Missing configured contributor: %', contributor;
    end if;

    select count(*), count(*) filter (where status = 'ACTIVE')
      into matching_rows, active_rows
    from public.shareholders
    where btrim(name) = contributor;

    if matching_rows = 0 then
      insert into public.shareholders (name, share_percentage, contributed_amount, status)
      values (contributor, 0, 0, 'ACTIVE');
    elsif matching_rows <> 1 or active_rows <> 1 then
      raise exception 'Review conflicting shareholder records for %', contributor;
    end if;
  end loop;
end $$;

commit;
