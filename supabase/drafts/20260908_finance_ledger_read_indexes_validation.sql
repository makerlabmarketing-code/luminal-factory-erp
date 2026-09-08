-- READ-ONLY POST-FORWARD VALIDATION
select
  to_regclass('public.financial_ledger_month_period_id_idx') is not null as ledger_month_index_ready,
  to_regclass('public.finance_expense_attachments_ledger_state_id_idx') is not null as attachment_lookup_index_ready;
