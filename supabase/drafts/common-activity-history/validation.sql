-- Read-only postflight: no customer records are changed.
select relrowsecurity as rls_enabled from pg_class where oid='public.erp_activity_events'::regclass;
select role,
 has_table_privilege(role,'public.erp_activity_events','SELECT') as can_read,
 has_table_privilege(role,'public.erp_activity_events','UPDATE') as can_rewrite,
 has_table_privilege(role,'public.erp_activity_events','DELETE') as can_delete,
 has_function_privilege(role,'public.update_erp_record_with_history(text,bigint,jsonb,bigint,text)','EXECUTE') as can_call_update
from unnest(array['anon','authenticated','service_role']) as role;
-- Expected: browser roles false throughout; service true,false,false,true.
select tgname,tgenabled from pg_trigger where tgname in ('employees_compact_activity','ledger_compact_activity');
select indexname from pg_indexes where tablename='erp_activity_events';
select count(*) as events,coalesce(max(octet_length(changes_text)),0) as largest_change_bytes,
 pg_size_pretty(pg_total_relation_size('public.erp_activity_events')) as total_with_indexes
from public.erp_activity_events;
