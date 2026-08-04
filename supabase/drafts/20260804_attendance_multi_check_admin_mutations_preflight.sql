-- READ-ONLY PREFLIGHT — RUN BEFORE FORWARD SQL
-- Every result is evidence only. PASS_CANDIDATE still requires operator review of every section.
-- Package contract: attendance_operation_audit; attendance_employee_date_shift_active_idx;
-- public.staff_attendance_multi_mutation(text);
-- public.admin_attendance_mutation(text,bigint,bigint,date,text,time without time zone,time without time zone,text,uuid);
-- policy "attendance operation audit admin select"; cancellation means cancelled_at is non-null.

select 'PREREQUISITES'::text as result_set,
       prerequisite,
       object_identity,
       case when object_identity is not null then 'PASS_CANDIDATE' else 'REVIEW_REQUIRED' end as assessment
from (values
  ('attendance table', to_regclass('public.attendance')::text),
  ('employees table', to_regclass('public.employees')::text),
  ('payroll settlements table', to_regclass('public.payroll_settlements')::text),
  ('cancellation audit table', to_regclass('public.attendance_cancellation_audit')::text),
  ('current employee function', to_regprocedure('public.current_employee_id()')::text),
  ('workspace access function', to_regprocedure('public.has_workspace_access(text)')::text),
  ('permission function', to_regprocedure('public.has_permission(text)')::text)
) checks(prerequisite, object_identity)
order by prerequisite;

with required(column_name) as (values
  ('id'), ('employee_id'), ('work_date'), ('shift_name'), ('check_in'), ('check_out'),
  ('total_hours'), ('total_salary'), ('status'), ('cancelled_at'),
  ('cancellation_reason'), ('cancelled_by_employee_id')
)
select 'ATTENDANCE_COLUMNS'::text as result_set,
       required.column_name,
       columns.data_type,
       columns.is_nullable,
       case when columns.column_name is not null then 'PASS_CANDIDATE' else 'REVIEW_REQUIRED_MISSING_COLUMN' end as assessment
from required
left join information_schema.columns columns
  on columns.table_schema = 'public'
 and columns.table_name = 'attendance'
 and columns.column_name = required.column_name
order by required.column_name;

select 'DUPLICATE_ACTIVE_GROUPS'::text as result_set,
       employee_id, work_date, shift_name, count(*)::integer as active_row_count,
       'REVIEW_REQUIRED'::text as assessment
from public.attendance
where cancelled_at is null
group by employee_id, work_date, shift_name
having count(*) > 1
order by active_row_count desc, employee_id, work_date, shift_name;

select 'ATTENDANCE_TOTALS'::text as result_set,
       count(*)::bigint as attendance_rows,
       count(*) filter (where cancelled_at is null)::bigint as active_rows,
       count(*) filter (where check_in is not null and check_out is null)::bigint as open_rows,
       case when count(*) filter (where cancelled_at is null) >= 0 then 'PASS_CANDIDATE' end as assessment
from public.attendance;

select 'EXISTING_ROLLOUT_OBJECTS'::text as result_set,
       object_name,
       object_identity,
       case when object_identity is null then 'PASS_CANDIDATE' else 'REVIEW_REQUIRED_ALREADY_EXISTS' end as assessment
from (values
  ('audit table', to_regclass('public.attendance_operation_audit')::text),
  ('partial unique index', to_regclass('public.attendance_employee_date_shift_active_idx')::text),
  ('audit state function', to_regprocedure('public.attendance_audit_state(public.attendance)')::text),
  ('Staff RPC', to_regprocedure('public.staff_attendance_multi_mutation(text)')::text),
  ('Admin RPC', to_regprocedure('public.admin_attendance_mutation(text,bigint,bigint,date,text,time without time zone,time without time zone,text,uuid)')::text)
) objects(object_name, object_identity)
order by object_name;
