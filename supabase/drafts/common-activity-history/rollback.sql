-- Disable ERP_ACTIVITY_HISTORY_ENABLED and redeploy first.
-- Preserve audit records; rollback removes capture/write functions only.
begin;
drop trigger if exists employees_compact_activity on public.employees;
drop trigger if exists ledger_compact_activity on public.financial_ledger;
drop function if exists public.capture_erp_activity();
drop function if exists public.update_erp_record_with_history(text,bigint,jsonb,bigint,text);
commit;
