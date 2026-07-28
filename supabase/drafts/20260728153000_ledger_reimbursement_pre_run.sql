-- Read-only pre-run. Stop unless every boolean is true and duplicate rows are empty.
select to_regclass('public.financial_ledger') is not null as ledger_exists,
       to_regclass('public.employees') is not null as employees_exists,
       to_regprocedure('public.current_employee_id()') is not null as actor_helper_exists,
       to_regprocedure('public.has_permission(text)') is not null as permission_helper_exists,
       to_regprocedure('public.has_workspace_access(text)') is not null as workspace_helper_exists;
select source_type,source_reference,count(*) from public.financial_ledger
where source_type is not null and source_reference is not null group by 1,2 having count(*)>1;
select count(*) as legacy_salary_rows_before from public.financial_ledger where lower(coalesce(type,'')) like '%luong%' or lower(coalesce(category,'')) like '%lương%';
