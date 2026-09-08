-- FORWARD PACKAGE — indexes only; requires explicit production approval before migration delivery.
begin;

create index if not exists financial_ledger_month_period_id_idx
on public.financial_ledger (month_period, id desc);

create index if not exists finance_expense_attachments_ledger_state_id_idx
on public.finance_expense_attachments (financial_ledger_id, verification_state, id);

commit;
