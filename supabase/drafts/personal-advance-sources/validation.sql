-- Read-only. Expect one ACTIVE row per configured payment source.
select e.full_name, count(distinct s.id) as active_source_count
from public.employees e
join public.finance_monthly_capital_rates r on r.employee_id = e.id
left join public.shareholders s on btrim(s.name) = btrim(e.full_name) and s.status = 'ACTIVE'
where e.full_name in ('Nguyễn Sơn Hà', 'Đào Tùng Duy')
group by e.full_name
order by e.full_name;
