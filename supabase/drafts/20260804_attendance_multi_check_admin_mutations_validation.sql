-- READ-ONLY POST-FORWARD VALIDATION
-- Run only after the approved forward SQL has completed.
-- Package contract: attendance_operation_audit; attendance_employee_date_shift_active_idx;
-- public.staff_attendance_multi_mutation(text);
-- public.admin_attendance_mutation(text,bigint,bigint,date,text,time without time zone,time without time zone,text,uuid);
-- policy "attendance operation audit admin select"; cancellation means cancelled_at is non-null.

select 'PARTIAL_UNIQUE_INDEX'::text as result_set,
       indexes.indexname,
       indexes.indexdef,
       catalog.indisvalid as is_valid,
       case when indexes.indexname is not null and catalog.indisvalid then 'PASS' else 'REVIEW_REQUIRED' end as assessment
from (values (1)) seed(value)
left join pg_indexes indexes
  on indexes.schemaname = 'public'
 and indexes.tablename = 'attendance'
 and indexes.indexname = 'attendance_employee_date_shift_active_idx'
left join pg_class relation on relation.oid = to_regclass('public.attendance_employee_date_shift_active_idx')
left join pg_index catalog on catalog.indexrelid = relation.oid;

select 'ROLLOUT_OBJECTS'::text as result_set,
       object_name,
       object_identity,
       case when object_identity is not null then 'PASS' else 'REVIEW_REQUIRED' end as assessment
from (values
  ('audit table', to_regclass('public.attendance_operation_audit')::text),
  ('Staff RPC', to_regprocedure('public.staff_attendance_multi_mutation(text)')::text),
  ('Admin RPC', to_regprocedure('public.admin_attendance_mutation(text,bigint,bigint,date,text,time without time zone,time without time zone,text,uuid)')::text)
) objects(object_name, object_identity)
order by object_name;

select 'AUDIT_RLS_POLICIES'::text as result_set,
       expected.policyname,
       policies.cmd,
       case when policies.policyname is not null and policies.cmd = 'SELECT' then 'PASS' else 'REVIEW_REQUIRED' end as assessment
from (values ('attendance operation audit admin select')) expected(policyname)
left join pg_policies policies
  on policies.schemaname = 'public'
 and policies.tablename = 'attendance_operation_audit'
 and policies.policyname = expected.policyname;

select 'DUPLICATE_ACTIVE_GROUPS'::text as result_set,
       employee_id, work_date, shift_name, count(*)::integer as active_row_count,
       'REVIEW_REQUIRED'::text as assessment
from public.attendance
where cancelled_at is null
group by employee_id, work_date, shift_name
having count(*) > 1;

-- Dynamic SQL prevents parse-time relation-not-found errors when the audit object is absent.
-- This block is read-only and emits one explicitly labelled NOTICE for the audit counts.
do $validation$
declare
  audit_counts jsonb;
begin
  if to_regclass('public.attendance_operation_audit') is null then
    raise notice 'AUDIT_COUNTS | REVIEW_REQUIRED | audit table is absent';
  else
    execute $query$
      select coalesce(jsonb_object_agg(operation, audit_count), '{}'::jsonb)
      from (
        select operation, count(*)::bigint as audit_count
        from public.attendance_operation_audit
        group by operation
        order by operation
      ) counts
    $query$ into audit_counts;
    raise notice 'AUDIT_COUNTS | PASS | %', audit_counts;
  end if;
end
$validation$;
