-- Operator rollback. Does not reverse ledger edits already committed through the function.
drop function if exists public.update_linked_financial_ledger_entry(bigint, text, text, text, numeric, text, text, boolean, text);
