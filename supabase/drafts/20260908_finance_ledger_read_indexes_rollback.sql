-- ROLLBACK — removes only package-owned indexes; no business rows are changed.
begin;

drop index if exists public.finance_expense_attachments_ledger_state_id_idx;
drop index if exists public.financial_ledger_month_period_id_idx;

commit;
