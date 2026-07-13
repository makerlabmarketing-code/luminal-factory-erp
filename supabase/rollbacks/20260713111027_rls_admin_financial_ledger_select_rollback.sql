-- Rollback for Batch 3C4 RLS slice 1.
-- Drops only the financial_ledger SELECT policy and helper function introduced
-- by 20260713111027_rls_admin_financial_ledger_select.sql.

drop policy if exists "financial ledger admin select" on public.financial_ledger;

revoke all on function public.is_app_admin() from public;
revoke all on function public.is_app_admin() from anon;
revoke all on function public.is_app_admin() from authenticated;

drop function if exists public.is_app_admin();
