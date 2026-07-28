-- Read-only pre-run validation for the phase status/dependency package.
-- Operator note: this file must not mutate production data.
select
  to_regclass('public.projects') is not null as projects_exists,
  to_regclass('public.employees') is not null as employees_exists,
  to_regclass('public.phases') is not null as phases_exists;

select status, count(*) as row_count
from public.phases
group by status
order by status;

select project_id, order_index, count(*) as duplicate_count
from public.phases
group by project_id, order_index
having count(*) > 1;

select count(*) as orphan_project_rows
from public.phases phase
left join public.projects project on project.id = phase.project_id
where phase.project_id is null or project.id is null;
