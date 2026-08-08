-- Rollback for finance linked-ledger atomic edit boundary.
-- Destructive capability rollback: execute only when reverting the owning application slice.
-- This drops the exact service-role-only RPC introduced by the forward migration.

drop function if exists public.update_linked_financial_ledger_entry(
  bigint, text, text, text, numeric, text, text, boolean, boolean, boolean,
  date, text, bigint, bigint, text, bigint, text
);
