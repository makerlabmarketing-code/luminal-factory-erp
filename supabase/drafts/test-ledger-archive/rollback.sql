-- Disable FINANCE_TEST_ARCHIVE_ENABLED first. Never delete audit or payment evidence.
begin;
do $$ begin if exists(select 1 from public.financial_ledger l join public.erp_activity_events e on e.entity='ledger' and e.entity_id=l.id where l.cancelled_at is not null and e.summary='Xóa mềm bản ghi thử #'||l.id) then raise exception 'restore_test_archives_before_rollback'; end if; end $$;
drop function public.set_test_ledger_archived(bigint,boolean,bigint,text);
commit;
