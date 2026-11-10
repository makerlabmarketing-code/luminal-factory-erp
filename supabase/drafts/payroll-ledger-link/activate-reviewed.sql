-- REVIEW PACKAGE: exact-ID repair + activation. Not an automatic migration.
-- Re-read this settlement/amount and check application flags immediately before use.
-- No payment confirmation, email queue, attendance update or second settlement.
begin;
select pg_advisory_xact_lock(hashtextextended('payroll-reopen-salary-payment',0));
do $$
declare
 reviewed_snapshot uuid := null;
 reviewed_employee bigint := null;
 reviewed_month date := null;
 reviewed_amount numeric := null;
 reviewed_actor bigint := null;
begin
 if reviewed_snapshot is null or reviewed_employee is null or reviewed_month is null or reviewed_amount is null or reviewed_actor is null then
  raise exception 'fill_privately_reviewed_reconciliation_identity';
 end if;
 if exists(select 1 from public.payroll_active_settlements a left join public.payroll_ledger_links k on k.settlement_id=a.settlement_id
  where k.settlement_id is null and a.settlement_id<>reviewed_snapshot) then
  raise exception 'unreviewed_active_payroll_requires_reconciliation';
 end if;
 perform payroll_link_private.reconcile_unlinked(reviewed_snapshot,reviewed_employee,reviewed_month,reviewed_amount,reviewed_actor);
 if exists(select 1 from payroll_link_private.write_permits) then raise exception 'payroll_link_permit_leak'; end if;
 update payroll_link_private.configuration set mode='ON' where singleton;
end $$;
commit;
