-- READ ONLY. Retain results with the operator evidence package.

select
  to_regclass('public.project_membership_audit') as audit_relation,
  to_regprocedure('public.mutate_project_membership(text,bigint,bigint,bigint,text,bigint,text,uuid)') as mutation_rpc,
  to_regprocedure('public.reject_project_membership_audit_mutation()') as immutable_guard;

select indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and indexname in (
    'project_members_one_active_employee',
    'project_membership_audit_project_occurred_idx',
    'project_membership_audit_employee_occurred_idx',
    'project_membership_audit_actor_occurred_idx'
  )
order by indexname;

select
  count(*) as duplicate_active_employee_groups
from (
  select project_id, employee_id
  from public.project_members
  where status = 'ACTIVE'
  group by project_id, employee_id
  having count(*) > 1
) duplicates;

select
  p.proname,
  p.prosecdef as security_definer,
  has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute,
  has_function_privilege('service_role', p.oid, 'EXECUTE') as service_role_execute
from pg_proc p
where p.oid = 'public.mutate_project_membership(text,bigint,bigint,bigint,text,bigint,text,uuid)'::regprocedure;

select grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('project_members', 'project_membership_audit')
  and grantee in ('anon', 'authenticated')
order by table_name, grantee, privilege_type;

select c.relname, c.relrowsecurity, c.relforcerowsecurity
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'project_membership_audit';

select tgname, pg_get_triggerdef(oid) as trigger_definition
from pg_trigger
where tgrelid = 'public.project_membership_audit'::regclass
  and not tgisinternal;

select
  operation,
  count(*) as event_count,
  count(*) filter (where length(btrim(reason)) < 10) as invalid_reason_count,
  count(*) filter (where before_state is null or after_state is null) as missing_state_count,
  count(*) filter (where correlation_id is null) as missing_correlation_count
from public.project_membership_audit
group by operation
order by operation;
