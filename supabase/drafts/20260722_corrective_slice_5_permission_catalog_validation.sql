-- Corrective Slice 5 permission catalog expansion validation draft.
-- LIVE_APPROVAL_REQUIRED companion; read-only validation after approved forward execution.

select
  code,
  case when code in ('TASK_VIEW', 'TASK_MANAGE', 'TASK_ASSIGN', 'TASK_REVIEW') then 'PASS' else 'FAIL' end as validation_status
from public.permissions
where code in ('TASK_VIEW', 'TASK_MANAGE', 'TASK_ASSIGN', 'TASK_REVIEW')
order by code;

select count(*) as task_permission_catalog_count
from public.permissions
where code in ('TASK_VIEW', 'TASK_MANAGE', 'TASK_ASSIGN', 'TASK_REVIEW');
